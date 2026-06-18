// ── Helpers ───────────────────────────────────────────────────────────────

function prTeamPct(t) { return t.w / (t.w + t.l); }

const PR_DIV_BONUS = { major: 0.06, supplemental: 0.02, minors1: -0.02, minors2: -0.06 };
function prEffPct(t) { return prTeamPct(t) + (PR_DIV_BONUS[t.division] || 0); }

function prPctStr(t) { return prTeamPct(t).toFixed(3).replace(/^0/, ""); }

const PR_DIV_COLORS = { major:"#58a6ff", supplemental:"#3fb950", minors1:"#d29922", minors2:"#8b949e" };
const PR_DIV_LABELS = { major:"MAJ", supplemental:"SUP", minors1:"M1", minors2:"M2" };

function prDivBadge(t) {
  const c = PR_DIV_COLORS[t.division] || "#8b949e";
  const l = PR_DIV_LABELS[t.division] || "?";
  return `<span class="pr-div-badge" style="color:${c}">${l}</span>`;
}

function getDivTeams(divKey) {
  return Object.entries(ABL.divisions[divKey].regions).flatMap(([region, teams]) =>
    teams.map(t => ({ ...t, division: divKey, region }))
  );
}

let _promoRand = Math.random; // fallback; replaced at start of each renderPromoRel()
function prSimGame(t1, t2) {
  const prob = Math.max(0.2, Math.min(0.8, 0.5 + (prEffPct(t1) - prEffPct(t2))));
  const winner = _promoRand() < prob ? t1 : t2;
  return { winner, loser: winner === t1 ? t2 : t1 };
}

// ── Relegation ─────────────────────────────────────────────────────────────
// 1st worst: auto-relegated
// 2nd–5th worst: playoff (2v5, 3v4) — losers relegated

function getRelegation(divKey) {
  const sorted = getDivTeams(divKey).sort((a, b) => prTeamPct(a) - prTeamPct(b));
  const auto = sorted[0];
  const p = sorted.slice(1, 5); // 2nd, 3rd, 4th, 5th worst

  const g1 = prSimGame(p[0], p[3]); // 2nd-worst vs 5th-worst
  const g2 = prSimGame(p[1], p[2]); // 3rd-worst vs 4th-worst

  return {
    auto,
    games: [
      { label: "2nd vs 5th worst", t1: p[0], t2: p[3], ...g1 },
      { label: "3rd vs 4th worst", t1: p[1], t2: p[2], ...g2 },
    ],
    relegated: [auto, g1.loser, g2.loser],
  };
}

// ── Promotion Tournament ───────────────────────────────────────────────────
// 1st best: automatic
// 2nd–5th best: round-robin (2v5, 3v4, 2v3, 4v5, 2v4, 3v5)
// Top 2 in tournament + auto = 3 promoted

function getPromotion(divKey) {
  const sorted = getDivTeams(divKey).sort((a, b) => prTeamPct(b) - prTeamPct(a));
  const auto = sorted[0];
  const p = sorted.slice(1, 5); // 2nd, 3rd, 4th, 5th best

  const pairs = [[0,3],[1,2],[0,1],[2,3],[0,2],[1,3]];
  const wins = Object.fromEntries(p.map(t => [t.abbr, 0]));
  const games = pairs.map(([a, b]) => {
    const result = prSimGame(p[a], p[b]);
    wins[result.winner.abbr]++;
    return { t1: p[a], t2: p[b], ...result };
  });

  const standings = [...p].sort((a, b) => {
    const d = wins[b.abbr] - wins[a.abbr];
    return d !== 0 ? d : prTeamPct(b) - prTeamPct(a);
  });

  return {
    auto,
    games,
    wins,
    standings,
    promoted: [auto, standings[0], standings[1]],
  };
}

// ── Rendering ──────────────────────────────────────────────────────────────

function teamPill(t, highlight = "") {
  return `
    <div class="pr-pill${highlight ? " pr-pill-" + highlight : ""}">
      ${prDivBadge(t)}
      <span class="pr-abbr">${t.abbr}</span>
      <span class="pr-name">${t.city} ${t.name}</span>
      <span class="pr-rec">${t.w}-${t.l} (${prPctStr(t)})</span>
    </div>`;
}

function gameRow(g, i) {
  return `
    <div class="pr-game">
      <span class="pr-game-label">Game ${i+1} · ${g.label || ""}</span>
      <span class="pr-game-teams">
        <span class="${g.winner === g.t1 ? "pr-gw" : "pr-gl"}">${g.t1.abbr}</span>
        <span class="pr-vs">vs</span>
        <span class="${g.winner === g.t2 ? "pr-gw" : "pr-gl"}">${g.t2.abbr}</span>
      </span>
      <span class="pr-game-result">→ <strong>${g.winner.abbr}</strong> wins</span>
    </div>`;
}

function tournamentSection(promo) {
  const rows = promo.standings.map((t, i) => `
    <div class="pr-tourn-row${i < 2 ? " pr-tourn-up" : ""}">
      <span class="pr-tourn-rank">${i+1}</span>
      <span class="pr-abbr">${t.abbr}</span>
      <span class="pr-name">${t.city} ${t.name}</span>
      <span class="pr-rec">${promo.wins[t.abbr]}-${3 - promo.wins[t.abbr]} tournament</span>
      ${i < 2 ? '<span class="pr-badge-up">▲ PROMOTED</span>' : ""}
    </div>`).join("");

  return `
    <details class="pr-details">
      <summary>Promotion Tournament results</summary>
      <div class="pr-games-list">
        ${promo.games.map((g, i) => gameRow(g, i)).join("")}
      </div>
      <div class="pr-tourn-table">${rows}</div>
    </details>`;
}

function relegPlayoffSection(rel) {
  return `
    <details class="pr-details">
      <summary>Relegation Playoff results</summary>
      <div class="pr-games-list">
        ${rel.games.map((g, i) => gameRow(g, i)).join("")}
      </div>
    </details>`;
}

function divSection(title, promoted, promDetails, relegated, relDetails, fromDiv, toDiv) {
  const arrow = (dir, label) =>
    `<div class="pr-arrow ${dir === "up" ? "pr-arrow-up" : "pr-arrow-down"}">${dir === "up" ? "▲" : "▼"} ${label}</div>`;

  const upBlock = promoted ? `
    <div class="pr-block pr-block-up">
      ${arrow("up", `Promoted to ${fromDiv}`)}
      ${promoted[0] ? teamPill(promoted[0], "auto") + '<div class="pr-auto-label">Automatic (best record)</div>' : ""}
      ${promoted.slice(1).map(t => teamPill(t, "promoted")).join("")}
      ${promDetails || ""}
    </div>` : "";

  const downBlock = relegated ? `
    <div class="pr-block pr-block-down">
      ${arrow("down", `Relegated to ${toDiv}`)}
      ${relegated[0] ? teamPill(relegated[0], "auto-rel") + '<div class="pr-auto-label">Automatic (worst record)</div>' : ""}
      ${relegated.slice(1).map(t => teamPill(t, "relegated")).join("")}
      ${relDetails || ""}
    </div>` : "";

  return `
    <div class="pr-section">
      <div class="pr-section-title">${title}</div>
      <div class="pr-section-body">
        ${upBlock}
        ${downBlock}
      </div>
    </div>`;
}

function renderPromoRel() {
  // Reset to same seed every render so results are deterministic
  _promoRand = window.ablSeededRand(window.ablSeed ^ 0xDADA9999);
  // Simulate all at once
  const majRel   = getRelegation("major");
  const supProm  = getPromotion("supplemental");
  const supRel   = getRelegation("supplemental");
  const m1Prom   = getPromotion("minors1");
  const m1Rel    = getRelegation("minors1");
  const m2Prom   = getPromotion("minors2");

  // Minors 2 expulsion: absolute worst record
  const m2Expelled = getDivTeams("minors2").sort((a, b) => prTeamPct(a) - prTeamPct(b))[0];

  return `
    <div class="pr-container">

      ${divSection(
        "Major Division",
        null, null,
        majRel.relegated,
        relegPlayoffSection(majRel),
        null, "Supplemental"
      )}

      ${divSection(
        "Supplemental Division",
        supProm.promoted,
        tournamentSection(supProm),
        supRel.relegated,
        relegPlayoffSection(supRel),
        "Major", "Minors 1"
      )}

      ${divSection(
        "Minors 1 Division",
        m1Prom.promoted,
        tournamentSection(m1Prom),
        m1Rel.relegated,
        relegPlayoffSection(m1Rel),
        "Supplemental", "Minors 2"
      )}

      ${divSection(
        "Minors 2 Division",
        m2Prom.promoted,
        tournamentSection(m2Prom),
        null, null,
        "Minors 1", null
      )}

      <div class="pr-section">
        <div class="pr-section-title">Minors 2 — Expulsion</div>
        <div class="pr-section-body">
          <div class="pr-block pr-block-expelled">
            <div class="pr-arrow pr-arrow-expelled">✗ Expelled from ABL</div>
            ${teamPill(m2Expelled, "expelled")}
            <div class="pr-auto-label">Worst overall record in Minors 2</div>
          </div>
        </div>
      </div>

      ${(function() {
        const allReserve = Object.values(ABL_RESERVE.regions).flat();
        const callUp = allReserve.reduce((best, t) =>
          (t.w / (t.w + t.l)) > (best.w / (best.w + best.l)) ? t : best
        );
        return `
          <div class="pr-section">
            <div class="pr-section-title">Reserve League — Call Up</div>
            <div class="pr-section-body">
              <div class="pr-block pr-block-up">
                <div class="pr-arrow pr-arrow-up">▲ Promoted into Minors 2</div>
                <div class="pr-pill pr-pill-auto">
                  <span class="pr-div-badge" style="color:#a371f7">RES</span>
                  <span class="pr-abbr">${callUp.abbr}</span>
                  <span class="pr-name">${callUp.city} ${callUp.name}</span>
                  <span class="pr-rec">${callUp.w}-${callUp.l} (${(callUp.w/(callUp.w+callUp.l)).toFixed(3).replace(/^0/,"")})</span>
                </div>
                <div class="pr-auto-label">Best record in the Reserve League</div>
              </div>
            </div>
          </div>`;
      })()}

    </div>`;
}
