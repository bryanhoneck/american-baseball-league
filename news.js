function getAllTeams() {
  const teams = [];
  for (const [divKey, div] of Object.entries(ABL.divisions)) {
    for (const [region, regionTeams] of Object.entries(div.regions)) {
      for (const team of regionTeams) {
        teams.push({ ...team, division: divKey, region });
      }
    }
  }
  return teams;
}

function teamPct(t) { return t.w / (t.w + t.l); }

const DIV_LABELS = { major: "Major", supplemental: "Supplemental", minors1: "Minors 1", minors2: "Minors 2" };

function pctDisplay(t) { return (teamPct(t) * 100).toFixed(1) + "%"; }

// ── Championship / Baseball Cup outcome (mirrors championship.js & baseball-cup.js,
// same seeded RNG streams, so results agree across pages even before they're visited) ──
const DIV_LABELS_SHORT = { major: "Major", supplemental: "Supplemental", minors1: "Minors 1", minors2: "Minors 2" };
const NEUTRAL_SITES = [
  "Fenway Park · Boston, MA",
  "Busch Stadium · St. Louis, MO",
  "Oracle Park · San Francisco, CA",
  "Coors Field · Denver, CO",
];

function computeSeasonWinners() {
  const cupRand = window.ablSeededRand(window.ablSeed ^ 0xBEEF1234);
  const champRand = window.ablSeededRand(window.ablSeed ^ 0xCAFE5678);
  const DIV_BONUS = { major: 0.06, supplemental: 0.02, minors1: -0.02, minors2: -0.06 };
  const effPct = t => teamPct(t) + (DIV_BONUS[t.division] || 0);

  function simScore(r, t1Wins) {
    const runs = isWinner => Math.max(0, (isWinner ? 5 : 3) + Math.floor(r() * 5) - 1);
    let winnerRuns = runs(true), loserRuns = runs(false);
    if (loserRuns >= winnerRuns) loserRuns = Math.max(0, winnerRuns - 1 - Math.floor(r() * 2));
    return t1Wins ? [winnerRuns, loserRuns] : [loserRuns, winnerRuns];
  }
  function simGame(t1, t2, t1IsHome) {
    const homeAdj = t1IsHome ? 0.04 : 0;
    const prob = Math.max(0.15, Math.min(0.85, 0.5 + (effPct(t1) - effPct(t2)) + homeAdj));
    const t1Wins = champRand() < prob;
    const [t1Score, t2Score] = simScore(champRand, t1Wins);
    return { winner: t1Wins ? t1 : t2, t1Score, t2Score };
  }
  function simCupGame(home, away) {
    const prob = Math.max(0.2, Math.min(0.8, 0.5 + (effPct(home) - effPct(away))));
    const homeWin = cupRand() < prob;
    simScore(cupRand, homeWin); // consume the same rand() calls as baseball-cup.js's simulateGame, to keep the stream in sync
    return homeWin ? home : away;
  }

  function runCupSimulation() {
    try {
      const s = JSON.parse(sessionStorage.getItem("abl_season_v3") || "{}");
      if (s.cupWinnerAbbr) {
        const found = getAllTeams().find(t => t.abbr === s.cupWinnerAbbr);
        if (found) return found;
      }
    } catch (e) {}

    const seeded = getAllTeams().sort((a, b) => teamPct(b) - teamPct(a));
    seeded.forEach((t, i) => { t.seed = i + 1; });
    const byeTeams = seeded.slice(0, 8);
    const r1Pool = seeded.slice(8);
    let r1Winners = [];
    for (let i = 0; i < r1Pool.length / 2; i++) {
      r1Winners.push(simCupGame(r1Pool[i], r1Pool[r1Pool.length - 1 - i]));
    }
    let pool = [...byeTeams, ...r1Winners].sort((a, b) => a.seed - b.seed);
    for (let round = 0; round < 6; round++) {
      const next = [];
      for (let i = 0; i < pool.length / 2; i++) {
        next.push(simCupGame(pool[i], pool[pool.length - 1 - i]));
      }
      pool = next.sort((a, b) => a.seed - b.seed);
    }
    const winner = pool[0];
    try {
      const s = JSON.parse(sessionStorage.getItem("abl_season_v3") || "{}");
      s.cupWinnerAbbr = winner.abbr;
      sessionStorage.setItem("abl_season_v3", JSON.stringify(s));
    } catch (e) {}
    return winner;
  }

  function buildField(cupWinner) {
    const major = ABL.divisions.major;
    const regionWinners = Object.entries(major.regions).map(([regionName, teams]) => {
      const best = [...teams].sort((a, b) => teamPct(b) - teamPct(a))[0];
      return { ...best, division: "major", region: regionName, qualifier: `Region Winner · ${regionName}` };
    }).sort((a, b) => teamPct(b) - teamPct(a));
    regionWinners.forEach((t, i) => { t.champSeed = i + 1; });

    const winnerAbbrs = new Set(regionWinners.map(t => t.abbr));
    const cupInMajors = winnerAbbrs.has(cupWinner.abbr);
    const remaining = Object.values(major.regions).flat()
      .map(t => ({ ...t, division: "major" }))
      .filter(t => !winnerAbbrs.has(t.abbr))
      .sort((a, b) => teamPct(b) - teamPct(a));

    const wc1 = { ...remaining[0], champSeed: 6, qualifier: "Wild Card 1" };
    const wc2 = { ...remaining[1], champSeed: 7, qualifier: "Wild Card 2" };
    const slot8 = cupInMajors
      ? { ...remaining[2], champSeed: 8, qualifier: "Wild Card 3" }
      : { ...cupWinner, champSeed: 8, qualifier: "Baseball Cup Winner" };

    return [...regionWinners, wc1, wc2, slot8];
  }

  function simSeries(hi, lo, bestOf, neutral = false) {
    const needed = Math.ceil(bestOf / 2);
    let hw = 0, lw = 0;
    const games = [];
    while (hw < needed && lw < needed) {
      const { winner, t1Score, t2Score } = simGame(hi, lo, !neutral);
      winner === hi ? hw++ : lw++;
      games.push({ hiScore: t1Score, loScore: t2Score });
    }
    return { winner: hw > lw ? hi : lo, hiWins: hw, loWins: lw, games };
  }

  const cupWinner = runCupSimulation();
  const field = buildField(cupWinner);
  const neutralSite = NEUTRAL_SITES[Math.floor(champRand() * NEUTRAL_SITES.length)];

  const qfPairs = [[0, 7], [1, 6], [2, 5], [3, 4]];
  const qf = qfPairs.map(([hi, lo]) => ({ hi: field[hi], lo: field[lo], ...simSeries(field[hi], field[lo], 3) }));

  const sfPairs = [[0, 3], [1, 2]];
  const sf = sfPairs.map(([a, b]) => {
    const hiTeam = qf[a].winner.champSeed < qf[b].winner.champSeed ? qf[a].winner : qf[b].winner;
    const loTeam = hiTeam === qf[a].winner ? qf[b].winner : qf[a].winner;
    return { hi: hiTeam, lo: loTeam, ...simSeries(hiTeam, loTeam, 3) };
  });

  const finHi = sf[0].winner.champSeed < sf[1].winner.champSeed ? sf[0].winner : sf[1].winner;
  const finLo = finHi === sf[0].winner ? sf[1].winner : sf[0].winner;
  const fin = { hi: finHi, lo: finLo, ...simSeries(finHi, finLo, 1, true) };

  const cupSeed = (() => {
    const ranked = getAllTeams().sort((a, b) => teamPct(b) - teamPct(a));
    return ranked.findIndex(t => t.abbr === cupWinner.abbr) + 1;
  })();

  return { cupWinner, cupSeed, champion: fin.winner, runnerUp: fin.winner === fin.hi ? fin.lo : fin.hi, fin, neutralSite };
}

function renderChampionshipBanners() {
  const { cupWinner, cupSeed, champion, runnerUp, fin, neutralSite } = computeSeasonWinners();

  const lastGame = fin.games[fin.games.length - 1];
  const champIsHi = champion === fin.hi;
  const champScore = champIsHi ? lastGame.hiScore : lastGame.loScore;
  const runnerScore = champIsHi ? lastGame.loScore : lastGame.hiScore;
  const champQualifier = champion.qualifier || "";

  return `
    <div class="home-champ-banner">
      <div class="hcb-eyebrow">🏆 ABL Championship</div>
      <div class="hcb-name">${champion.city} ${champion.name}</div>
      <div class="hcb-sub">${champQualifier ? `${champQualifier} · ` : ""}${DIV_LABELS_SHORT[champion.division] || ""}</div>
      <p class="hcb-body">
        The ${champion.city} ${champion.name} are this season's ABL Champions, defeating the
        ${runnerUp.city} ${runnerUp.name} ${champScore}-${runnerScore} in a winner-take-all finale
        at ${neutralSite}. It's the culmination of a deep eight-team tournament that ran through
        the Major Division's region winners, wild cards, and the Baseball Cup champion.
      </p>
    </div>

    <div class="home-cup-banner">
      <div class="hcub-eyebrow">⚾ Baseball Cup Champion</div>
      <div class="hcub-name">${cupWinner.city} ${cupWinner.name}</div>
      <p class="hcub-body">
        Seeded #${cupSeed} entering the league-wide, single-elimination bracket, the
        ${cupWinner.city} ${cupWinner.name} ran the gauntlet to capture the Baseball Cup —
        the midseason crown open to all 120 ABL teams across every division.
      </p>
    </div>`;
}

// ── League News ─────────────────────────────────────────────────────────────
function renderLeagueNews() {
  const teams = getAllTeams().sort((a, b) => teamPct(b) - teamPct(a));
  const best = teams[0];
  const worst = teams[teams.length - 1];
  const minors2Best = teams.find(t => t.division === "minors2");

  let tightestRegion = null, tightestSpread = 99;
  for (const [divKey, div] of Object.entries(ABL.divisions)) {
    for (const [regionName, regionTeams] of Object.entries(div.regions)) {
      const sorted = [...regionTeams].sort((a, b) => teamPct(b) - teamPct(a));
      const spread = teamPct(sorted[0]) - teamPct(sorted[sorted.length - 1]);
      if (spread < tightestSpread) {
        tightestSpread = spread;
        tightestRegion = { name: regionName, divKey, spread };
      }
    }
  }

  const games = window.ablGames || [];
  let blowout = null;
  for (const g of games) {
    const margin = Math.abs(g.homeScore - g.awayScore);
    if (!blowout || margin > blowout.margin) {
      blowout = { ...g, margin };
    }
  }

  const articles = [];

  articles.push({
    headline: `${best.city} ${best.name} Lead the League`,
    body: `The ${best.city} ${best.name} own the league's best record at ${best.w}–${best.l} (${pctDisplay(best)}), pacing the ${DIV_LABELS[best.division]} division.`,
  });

  if (tightestRegion) {
    articles.push({
      headline: `${tightestRegion.name} Race Couldn't Be Tighter`,
      body: `The ${tightestRegion.name} region in the ${DIV_LABELS[tightestRegion.divKey]} division has just a ${(tightestRegion.spread * 100).toFixed(1)}% win-rate spread from top to bottom — anyone's race.`,
    });
  }

  if (blowout && blowout.margin > 0) {
    const winner = blowout.homeScore > blowout.awayScore
      ? `${blowout.homeAbbr} ${blowout.homeScore}-${blowout.awayScore} over ${blowout.awayAbbr}`
      : `${blowout.awayAbbr} ${blowout.awayScore}-${blowout.homeScore} over ${blowout.homeAbbr}`;
    articles.push({
      headline: `Season's Biggest Blowout`,
      body: `${winner} on ${blowout.date} stands as the largest margin of victory league-wide this season, a ${blowout.margin}-run decision.`,
    });
  }

  articles.push({
    headline: `${minors2Best.city} ${minors2Best.name} Lead Minors 2`,
    body: `Down in Minors 2, the ${minors2Best.city} ${minors2Best.name} sit atop the division at ${minors2Best.w}–${minors2Best.l} (${pctDisplay(minors2Best)}).`,
  });

  articles.push({
    headline: `${worst.city} ${worst.name} Searching for Answers`,
    body: `At ${worst.w}–${worst.l} (${pctDisplay(worst)}), the ${worst.city} ${worst.name} hold the league's worst record this season.`,
  });

  return `
    <div class="home-news-grid">
      ${articles.map(a => `
        <div class="home-news-article">
          <div class="tf-news-headline">${a.headline}</div>
          <div class="tf-news-body">${a.body}</div>
        </div>`).join("")}
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  document.getElementById("news-app").innerHTML = `
    ${renderChampionshipBanners()}

    <div class="home-section-label">League News</div>

    ${renderLeagueNews()}
  `;
}

render();
