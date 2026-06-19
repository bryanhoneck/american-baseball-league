// Seeded RNG derived from the shared season seed (set by season.js)
const _cupRand = window.ablSeededRand(window.ablSeed ^ 0xBEEF1234);

// Gather all 120 teams with division/region metadata
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

// Higher divisions get a small talent bonus so upsets are possible but rarer
const DIV_BONUS = { major: 0.06, supplemental: 0.02, minors1: -0.02, minors2: -0.06 };
function effectivePct(t) { return teamPct(t) + (DIV_BONUS[t.division] || 0); }

function simScore(rand, homeWin) {
  function runs(isWinner) { return Math.max(0, (isWinner ? 5 : 3) + Math.floor(rand() * 5) - 1); }
  let winnerRuns = runs(true);
  let loserRuns  = runs(false);
  if (loserRuns >= winnerRuns) loserRuns = Math.max(0, winnerRuns - 1 - Math.floor(rand() * 2));
  return homeWin ? [winnerRuns, loserRuns] : [loserRuns, winnerRuns];
}

function simulateGame(home, away) {
  const prob = Math.max(0.2, Math.min(0.8, 0.5 + (effectivePct(home) - effectivePct(away))));
  const homeWin = _cupRand() < prob;
  const [homeScore, awayScore] = simScore(_cupRand, homeWin);
  return { winner: homeWin ? home : away, homeScore, awayScore };
}

function simulateCup() {
  const seeded = getAllTeams().sort((a, b) => teamPct(b) - teamPct(a));
  seeded.forEach((t, i) => { t.seed = i + 1; });

  const rounds = [];

  // Round 1: seeds 9–120 play (56 games); seeds 1–8 get byes
  const byeTeams = seeded.slice(0, 8);
  const r1Pool = seeded.slice(8); // 112 teams
  const r1Matchups = [];
  for (let i = 0; i < r1Pool.length / 2; i++) {
    const home = r1Pool[i];
    const away = r1Pool[r1Pool.length - 1 - i];
    r1Matchups.push({ home, away, ...simulateGame(home, away) });
  }
  rounds.push({ name: "Round 1", label: "R1", matchups: r1Matchups });

  // Subsequent rounds: winners re-seeded, top-half vs bottom-half
  const roundDefs = [
    { name: "Round 2",     label: "R2" },
    { name: "Round 3",     label: "R3" },
    { name: "Round 4",     label: "R4" },
    { name: "Quarterfinal",label: "QF" },
    { name: "Semifinal",   label: "SF" },
    { name: "Final",       label: "F"  },
  ];

  let pool = [...byeTeams, ...r1Matchups.map(m => m.winner)]
    .sort((a, b) => a.seed - b.seed);

  for (const def of roundDefs) {
    const matchups = [];
    for (let i = 0; i < pool.length / 2; i++) {
      const home = pool[i];
      const away = pool[pool.length - 1 - i];
      matchups.push({ home, away, ...simulateGame(home, away) });
    }
    rounds.push({ ...def, matchups });
    pool = matchups.map(m => m.winner).sort((a, b) => a.seed - b.seed);
  }

  return { rounds, winner: pool[0], byeTeams };
}

// ── Rendering ─────────────────────────────────────────────────────────────

const DIV_LABELS = {
  major: "MAJ", supplemental: "SUP", minors1: "M1", minors2: "M2"
};
const DIV_COLORS = {
  major: "#58a6ff", supplemental: "#3fb950", minors1: "#d29922", minors2: "#8b949e"
};

function teamTag(t) {
  const color = DIV_COLORS[t.division] || "#8b949e";
  return `<span class="div-badge" style="color:${color}">${DIV_LABELS[t.division]}</span>`;
}

function pctStr(t) { return teamPct(t).toFixed(3).replace(/^0/, ""); }

function matchupCard(m, isFinal) {
  const hw = m.winner.abbr === m.home.abbr;
  const aw = m.winner.abbr === m.away.abbr;
  return `
    <div class="matchup-card${isFinal ? " matchup-final" : ""}">
      <div class="matchup-row${hw ? " winner" : " loser"}">
        <span class="seed">#${m.home.seed}</span>
        ${teamTag(m.home)}
        <span class="abbr">${m.home.abbr}</span>
        <span class="mname">${m.home.city} ${m.home.name}</span>
        <span class="mpct">${pctStr(m.home)}</span>
        <span class="mscore">${m.homeScore}</span>
        ${hw ? '<span class="win-mark">✓</span>' : '<span class="win-mark"></span>'}
      </div>
      <div class="matchup-row${aw ? " winner" : " loser"}">
        <span class="seed">#${m.away.seed}</span>
        ${teamTag(m.away)}
        <span class="abbr">${m.away.abbr}</span>
        <span class="mname">${m.away.city} ${m.away.name}</span>
        <span class="mpct">${pctStr(m.away)}</span>
        <span class="mscore">${m.awayScore}</span>
        ${aw ? '<span class="win-mark">✓</span>' : '<span class="win-mark"></span>'}
      </div>
    </div>`;
}

let activeRound = 0;
let cupData = null;

function renderRoundTabs() {
  return `<div class="tab-bar">` +
    cupData.rounds.map((r, i) => `
      <button class="tab-btn${i === activeRound ? " active" : ""}" data-round="${i}">
        ${r.label}
      </button>`).join("") +
    `<button class="tab-btn${activeRound === "bracket" ? " active" : ""}" data-round="bracket">Bracket</button>` +
  `</div>`;
}

// ── Bracket view ──────────────────────────────────────────────────────────────

function renderBracket() {
  const qfRound  = cupData.rounds[4]; // 4 matchups
  const sfRound  = cupData.rounds[5]; // 2 matchups
  const finRound = cupData.rounds[6]; // 1 matchup
  const winner   = cupData.winner;

  // Trace winner paths: find which QF/SF game each team came from
  function findIn(round, team) {
    return round.matchups.find(m => m.winner.abbr === team.abbr);
  }
  function findIdxIn(round, team) {
    return round.matchups.findIndex(m => m.winner.abbr === team.abbr);
  }

  // Order SF so the game that produced the final's home team comes first
  const fin = finRound.matchups[0];
  const sfTopIdx = findIdxIn(sfRound, fin.home);
  const orderedSF = sfTopIdx === 0
    ? [sfRound.matchups[0], sfRound.matchups[1]]
    : [sfRound.matchups[1], sfRound.matchups[0]];

  // Order QF so pairs that feed the same SF game are adjacent
  function qfPairFor(sfGame) {
    const a = findIdxIn(qfRound, sfGame.home);
    const b = findIdxIn(qfRound, sfGame.away);
    return [qfRound.matchups[a], qfRound.matchups[b]];
  }
  const orderedQF = [...qfPairFor(orderedSF[0]), ...qfPairFor(orderedSF[1])];

  function bvCard(m) {
    const hw = m.winner.abbr === m.home.abbr;
    return `
      <div class="bv-card">
        <div class="bv-team ${hw ? "bv-w" : "bv-l"}">
          <span class="bv-seed">#${m.home.seed}</span>
          <span class="bv-abbr">${m.home.abbr}</span>
          <span class="bv-name">${m.home.city} ${m.home.name}</span>
          <span class="bv-score">${m.homeScore}</span>
          ${hw ? '<span class="bv-check">✓</span>' : '<span class="bv-check"></span>'}
        </div>
        <div class="bv-team ${!hw ? "bv-w" : "bv-l"}">
          <span class="bv-seed">#${m.away.seed}</span>
          <span class="bv-abbr">${m.away.abbr}</span>
          <span class="bv-name">${m.away.city} ${m.away.name}</span>
          <span class="bv-score">${m.awayScore}</span>
          ${!hw ? '<span class="bv-check">✓</span>' : '<span class="bv-check"></span>'}
        </div>
      </div>`;
  }

  return `
    <div class="bv-wrap" id="bv-container">
      <svg class="bv-svg" id="bv-lines"></svg>

      <div class="bv-col">
        <div class="bv-col-label">Quarterfinals</div>
        ${orderedQF.map(m => `<div class="bv-slot bv-slot-qf">${bvCard(m)}</div>`).join("")}
      </div>

      <div class="bv-col">
        <div class="bv-col-label">Semifinals</div>
        ${orderedSF.map(m => `<div class="bv-slot bv-slot-sf">${bvCard(m)}</div>`).join("")}
      </div>

      <div class="bv-col">
        <div class="bv-col-label">Final</div>
        <div class="bv-slot bv-slot-f">${bvCard(fin)}</div>
      </div>

      <div class="bv-col">
        <div class="bv-col-label">Champion</div>
        <div class="bv-slot bv-slot-champ">
          <div class="bv-champ-card">
            <div class="bv-trophy">🏆</div>
            <div class="bv-champ-name">${winner.city} ${winner.name}</div>
            <div class="bv-champ-sub">Seed #${winner.seed} · ${winner.w}–${winner.l}</div>
          </div>
        </div>
      </div>
    </div>`;
}

function drawBracketLines() {
  const container = document.getElementById("bv-container");
  const svg       = document.getElementById("bv-lines");
  if (!container || !svg) return;

  const cr = container.getBoundingClientRect();
  const W  = container.scrollWidth;
  const H  = container.scrollHeight;
  svg.style.width  = W + "px";
  svg.style.height = H + "px";
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const S = "#30363d";
  let html = "";

  function midY(el) {
    const r = el.getBoundingClientRect();
    return (r.top + r.bottom) / 2 - cr.top;
  }
  function rX(slot) {
    const c = slot.querySelector(".bv-card,.bv-champ-card");
    return c ? c.getBoundingClientRect().right  - cr.left : 0;
  }
  function lX(slot) {
    const c = slot.querySelector(".bv-card,.bv-champ-card");
    return c ? c.getBoundingClientRect().left   - cr.left : 0;
  }
  function cY(slot) {
    const c = slot.querySelector(".bv-card,.bv-champ-card");
    return c ? midY(c) : 0;
  }

  function h(x1, y, x2) {
    html += `<line x1="${x1.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${S}" stroke-width="1.5"/>`;
  }
  function v(x, y1, y2) {
    if (Math.abs(y2 - y1) < 0.5) return;
    html += `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${S}" stroke-width="1.5"/>`;
  }

  function connectPair(a, b, target) {
    const yA = cY(a), yB = cY(b), yT = cY(target);
    const xA = rX(a), xB = rX(b), xT = lX(target);
    const xM = (Math.max(xA, xB) + xT) / 2;
    const yM = (yA + yB) / 2;
    h(xA, yA, xM);
    h(xB, yB, xM);
    v(xM, yA, yB);
    h(xM, yM, xT);
    v(xT, yM, yT);
  }

  const qf = [...container.querySelectorAll(".bv-slot-qf")];
  const sf = [...container.querySelectorAll(".bv-slot-sf")];
  const f  = container.querySelector(".bv-slot-f");
  const ch = container.querySelector(".bv-slot-champ");

  if (qf.length === 4 && sf.length === 2 && f && ch) {
    connectPair(qf[0], qf[1], sf[0]);
    connectPair(qf[2], qf[3], sf[1]);
    connectPair(sf[0], sf[1], f);
    const yF = cY(f), xFR = rX(f), xCL = lX(ch), yCL = cY(ch);
    h(xFR, yF, xCL);
    v(xCL, yF, yCL);
  }

  svg.innerHTML = html;
}

function renderRound() {
  const round = cupData.rounds[activeRound];
  const isFinal = round.label === "F";
  const cards = round.matchups.map(m => matchupCard(m, isFinal)).join("");
  const mobile = window.innerWidth <= 640;
  const cols = mobile ? "1fr"
             : round.matchups.length <= 4 ? "repeat(" + round.matchups.length + ", 1fr)"
             : "repeat(4, 1fr)";

  let byeBanner = "";
  if (activeRound === 0) {
    byeBanner = `
      <div class="bye-banner">
        <span class="bye-label">First-round byes — Seeds 1–8</span>
        <div class="bye-pills">
          ${cupData.byeTeams.map(t => `
            <div class="bye-pill">
              <span class="bye-seed">#${t.seed}</span>
              <span class="div-badge" style="color:${DIV_COLORS[t.division]}">${DIV_LABELS[t.division]}</span>
              <span class="bye-abbr">${t.abbr}</span>
              <span class="bye-name">${t.city} ${t.name}</span>
            </div>`).join("")}
        </div>
      </div>`;
  }

  return `
    ${byeBanner}
    <div class="round-header">
      <span class="round-name">${round.name}</span>
      <span class="round-count">${round.matchups.length} match${round.matchups.length > 1 ? "es" : ""}</span>
    </div>
    <div class="matchup-grid" style="grid-template-columns:${cols}">
      ${cards}
    </div>`;
}

function render() {
  const app = document.getElementById("cup-app");
  if (!cupData) {
    cupData = simulateCup();
    // Persist winner so championship page always shows the same team
    try {
      const s = JSON.parse(sessionStorage.getItem("abl_season_v3") || "{}");
      s.cupWinnerAbbr = cupData.winner.abbr;
      sessionStorage.setItem("abl_season_v3", JSON.stringify(s));
    } catch(e) {}
  }
  const content  = activeRound === "bracket" ? renderBracket() : renderRound();
  app.innerHTML  = renderRoundTabs() + content;

  app.querySelectorAll(".tab-btn[data-round]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.round;
      activeRound = v === "bracket" ? "bracket" : parseInt(v);
      render();
    });
  });

  if (activeRound === "bracket") setTimeout(drawBracketLines, 60);
}

render();
