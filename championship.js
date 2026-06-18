// Cup sim uses the SAME seed offset as baseball-cup.js → identical winner
const _cupSimRand = window.ablSeededRand(window.ablSeed ^ 0xBEEF1234);
// Championship bracket uses its own stream
const _champRand  = window.ablSeededRand(window.ablSeed ^ 0xCAFE5678);

// ── Shared helpers (mirrored from baseball-cup.js) ────────────────────────

function teamPct(t) { return t.w / (t.w + t.l); }

const DIV_BONUS = { major: 0.06, supplemental: 0.02, minors1: -0.02, minors2: -0.06 };
function effectivePct(t) { return teamPct(t) + (DIV_BONUS[t.division] || 0); }

function pctStr(t) { return teamPct(t).toFixed(3).replace(/^0/, ""); }

const DIV_LABELS  = { major: "MAJ", supplemental: "SUP", minors1: "M1", minors2: "M2" };
const DIV_COLORS  = { major: "#58a6ff", supplemental: "#3fb950", minors1: "#d29922", minors2: "#8b949e" };
function divBadge(t) {
  return `<span class="div-badge" style="color:${DIV_COLORS[t.division]}">${DIV_LABELS[t.division]}</span>`;
}

// ── Cup simulation (abbreviated — just need the winner) ───────────────────

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

function simGame(t1, t2, t1IsHome) {
  const homeAdj = t1IsHome ? 0.04 : 0;
  const prob = Math.max(0.15, Math.min(0.85,
    0.5 + (effectivePct(t1) - effectivePct(t2)) + homeAdj));
  return _champRand() < prob ? t1 : t2;
}

// Matches baseball-cup.js simulateGame exactly (no home adj, clamp 0.2–0.8)
function simCupGame(home, away) {
  const prob = Math.max(0.2, Math.min(0.8, 0.5 + (effectivePct(home) - effectivePct(away))));
  return _cupSimRand() < prob ? home : away;
}

function runCupSimulation() {
  // If baseball-cup.js already ran this session, use its stored winner
  try {
    const s = JSON.parse(sessionStorage.getItem("abl_season_v3") || "{}");
    if (s.cupWinnerAbbr) {
      for (const [divKey, div] of Object.entries(ABL.divisions)) {
        for (const [region, teams] of Object.entries(div.regions)) {
          const found = teams.find(t => t.abbr === s.cupWinnerAbbr);
          if (found) return { ...found, division: divKey, region };
        }
      }
    }
  } catch(e) {}

  // Sort by teamPct (not effectivePct) to match baseball-cup.js seeding
  const seeded = getAllTeams().sort((a, b) => teamPct(b) - teamPct(a));
  seeded.forEach((t, i) => { t.seed = i + 1; });

  const byeTeams = seeded.slice(0, 8);
  const r1Pool   = seeded.slice(8);
  let r1Winners  = [];
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
  return pool[0];
}

// ── Championship field builder ─────────────────────────────────────────────

function buildField(cupWinner) {
  const major = ABL.divisions.major;

  const regionWinners = Object.entries(major.regions).map(([regionName, teams]) => {
    const best = [...teams].sort((a, b) => teamPct(b) - teamPct(a))[0];
    return { ...best, division: "major", region: regionName };
  }).sort((a, b) => teamPct(b) - teamPct(a));

  regionWinners.forEach((t, i) => {
    t.champSeed = i + 1;
    t.qualifier  = `Region Winner · ${t.region}`;
  });

  const winnerAbbrs = new Set(regionWinners.map(t => t.abbr));
  const cupInMajors  = winnerAbbrs.has(cupWinner.abbr);

  const remaining = Object.values(major.regions).flat()
    .map(t => ({ ...t, division: "major" }))
    .filter(t => !winnerAbbrs.has(t.abbr))
    .sort((a, b) => teamPct(b) - teamPct(a));

  const wc1 = { ...remaining[0], champSeed: 6, qualifier: "Wild Card 1" };
  const wc2 = { ...remaining[1], champSeed: 7, qualifier: "Wild Card 2" };

  let slot8;
  if (cupInMajors) {
    slot8 = { ...remaining[2], champSeed: 8, qualifier: "Wild Card 3 (Cup winner already seeded)" };
  } else {
    slot8 = { ...cupWinner, champSeed: 8, qualifier: "Baseball Cup Winner" };
  }

  return [...regionWinners, wc1, wc2, slot8];
}

// ── Bracket simulation ─────────────────────────────────────────────────────

function simSeries(hi, lo, bestOf, neutral = false) {
  const needed = Math.ceil(bestOf / 2);
  let hw = 0, lw = 0;
  while (hw < needed && lw < needed) {
    const winner = simGame(hi, lo, !neutral);
    winner === hi ? hw++ : lw++;
  }
  return { winner: hw > lw ? hi : lo, hiWins: hw, loWins: lw };
}

const NEUTRAL_SITES = [
  "Fenway Park · Boston, MA",
  "Busch Stadium · St. Louis, MO",
  "Oracle Park · San Francisco, CA",
  "Coors Field · Denver, CO",
];

function simulateChampionship() {
  const cupWinner  = runCupSimulation();
  const field      = buildField(cupWinner);
  const neutralSite = NEUTRAL_SITES[Math.floor(_champRand() * NEUTRAL_SITES.length)];

  // Matchups: 1v8, 2v7, 3v6, 4v5
  const qfPairs = [[0,7],[1,6],[2,5],[3,4]];
  const qf = qfPairs.map(([hi, lo]) => {
    const result = simSeries(field[hi], field[lo], 3);
    return { hi: field[hi], lo: field[lo], ...result };
  });

  // SF: QF1w vs QF4w, QF2w vs QF3w
  const sfPairs = [[0,3],[1,2]];
  const sf = sfPairs.map(([a, b]) => {
    const hiTeam = qf[a].winner.champSeed < qf[b].winner.champSeed ? qf[a].winner : qf[b].winner;
    const loTeam = hiTeam === qf[a].winner ? qf[b].winner : qf[a].winner;
    const result = simSeries(hiTeam, loTeam, 3);
    return { hi: hiTeam, lo: loTeam, ...result };
  });

  // Final: neutral site, 1 game
  const finHi = sf[0].winner.champSeed < sf[1].winner.champSeed ? sf[0].winner : sf[1].winner;
  const finLo = finHi === sf[0].winner ? sf[1].winner : sf[0].winner;
  const fin = { hi: finHi, lo: finLo, ...simSeries(finHi, finLo, 1, true) };

  return { cupWinner, field, qf, sf, fin, neutralSite };
}

// ── Rendering ──────────────────────────────────────────────────────────────

function teamRow(t, isWinner) {
  return `
    <div class="b-row${isWinner ? " b-winner" : " b-loser"}">
      <span class="b-seed">${t.champSeed}</span>
      ${divBadge(t)}
      <span class="b-abbr">${t.abbr}</span>
      <span class="b-name">${t.city} ${t.name}</span>
      <span class="b-pct">${pctStr(t)}</span>
      ${isWinner ? '<span class="b-check">✓</span>' : '<span class="b-check"></span>'}
    </div>`;
}

function seriesCard(matchup, label, scoreLabel) {
  const { hi, lo, winner, hiWins, loWins } = matchup;
  const hiWon = winner.abbr === hi.abbr;
  return `
    <div class="b-card">
      <div class="b-card-label">${label}</div>
      ${teamRow(hi, hiWon)}
      ${teamRow(lo, !hiWon)}
      ${scoreLabel ? `<div class="b-score">${hiWins}–${loWins} ${scoreLabel}</div>` : ""}
    </div>`;
}

function renderTabContent(activeTab, qf, sf, fin, neutralSite) {
  if (activeTab === "qf") {
    return `
      <div class="champ-round-label">Quarterfinals <span class="champ-round-sub">Best of 3</span></div>
      <div class="champ-cards">
        ${qf.map((m, i) => seriesCard(m, `QF${i+1}`, "series")).join("")}
      </div>`;
  }
  if (activeTab === "sf") {
    return `
      <div class="champ-round-label">Semifinals <span class="champ-round-sub">Best of 3</span></div>
      <div class="champ-cards">
        ${sf.map((m, i) => seriesCard(m, `SF${i+1}`, "series")).join("")}
      </div>`;
  }
  if (activeTab === "final") {
    return `
      <div class="champ-round-label">Final <span class="champ-round-sub">${neutralSite}</span></div>
      <div class="champ-cards">
        ${seriesCard(fin, "Final", null)}
      </div>
      <div class="champion-banner">
        <div class="champ-trophy">🏆</div>
        <div class="champ-name">${fin.winner.city} ${fin.winner.name}</div>
        <div class="champ-sub">ABL Champion · Seed #${fin.winner.champSeed}</div>
      </div>`;
  }
  // bracket view
  return `
    <div class="bracket">
      <div class="bracket-col bracket-qf">
        <div class="col-label">Quarterfinals <span class="col-sub">Best of 3</span></div>
        ${qf.map((m, i) => seriesCard(m, `QF${i+1}`, "series")).join("")}
      </div>
      <div class="bracket-col bracket-sf">
        <div class="col-label">Semifinals <span class="col-sub">Best of 3</span></div>
        ${sf.map((m, i) => seriesCard(m, `SF${i+1}`, "series")).join("")}
      </div>
      <div class="bracket-col bracket-final">
        <div class="col-label">Final <span class="col-sub">${neutralSite}</span></div>
        ${seriesCard(fin, "Final", null)}
        <div class="champion-banner">
          <div class="champ-trophy">🏆</div>
          <div class="champ-name">${fin.winner.city} ${fin.winner.name}</div>
          <div class="champ-sub">ABL Champion · Seed #${fin.winner.champSeed}</div>
        </div>
      </div>
    </div>`;
}

let activeTab = "qf";
let data = null;

function render() {
  if (!data) data = simulateChampionship();
  const { cupWinner, field, qf, sf, fin, neutralSite } = data;

  const cupNote = field[7].qualifier.includes("Cup")
    ? `<div class="cup-note">⚾ Baseball Cup winner: <strong>${cupWinner.city} ${cupWinner.name}</strong> (${DIV_LABELS[cupWinner.division]} · Seed #${cupWinner.seed || "—"} · ${pctStr(cupWinner)})</div>`
    : `<div class="cup-note">⚾ Baseball Cup winner <strong>${cupWinner.city} ${cupWinner.name}</strong> was already seeded as a region winner — next WC promoted.</div>`;

  const tabs = [
    { key: "qf",      label: "QF"      },
    { key: "sf",      label: "SF"      },
    { key: "final",   label: "Final"   },
    { key: "bracket", label: "Bracket" },
  ];

  document.getElementById("champ-app").innerHTML = `
    ${cupNote}
    <div class="tab-bar">
      ${tabs.map(t => `<button class="tab-btn${activeTab === t.key ? " active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("")}
    </div>
    <div class="champ-content">
      ${renderTabContent(activeTab, qf, sf, fin, neutralSite)}
    </div>`;

  document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => { activeTab = btn.dataset.tab; render(); });
  });
}

render();
