let activeTab = "major";
let selectedTeamAbbr = null;

const TAB_ORDER = ["major", "supplemental", "minors1", "minors2", "reserve", "team", "promorel"];
const TAB_LABELS = {
  major:       "Major Division",
  supplemental:"Supplemental",
  minors1:     "Minors 1",
  minors2:     "Minors 2",
  reserve:     "Reserve",
  team:        "Team",
  promorel:    "Prom / Rel",
};

const TF_DIV_LABELS = { major: "MAJ", supplemental: "SUP", minors1: "M1", minors2: "M2", reserve: "RES" };
const TF_DIV_COLORS = { major: "#58a6ff", supplemental: "#3fb950", minors1: "#d29922", minors2: "#8b949e", reserve: "#8b5cf6" };
function tfPct(t) { return t.w / (t.w + t.l); }

// Legend text varies by division
const LEGEND_LINES = {
  major: [
    { swatch: "swatch-green",  label: "Region winner — qualifies for ABL Championship" },
    { swatch: "swatch-red",    label: "Last in region — relegation candidate" },
  ],
  supplemental: [
    { swatch: "swatch-green",  label: "1st place — automatic promotion to Major Division" },
    { swatch: "swatch-yellow", label: "2nd–5th — enter Promotion Tournament" },
    { swatch: "swatch-red",    label: "Last in region — relegation candidate" },
  ],
  minors1: [
    { swatch: "swatch-green",  label: "1st place — automatic promotion to Supplemental" },
    { swatch: "swatch-yellow", label: "2nd–5th — enter Promotion Tournament" },
    { swatch: "swatch-red",    label: "Last in region — relegation candidate" },
  ],
  minors2: [
    { swatch: "swatch-green",  label: "1st place — automatic promotion to Minors 1" },
    { swatch: "swatch-yellow", label: "2nd–5th — enter Promotion Tournament" },
    { swatch: "swatch-red",    label: "Worst record overall (1 team) — expelled from ABL" },
  ],
};

function pct(w, l) {
  const total = w + l;
  if (total === 0) return ".000";
  return (w / total).toFixed(3).replace(/^0/, "");
}

function gb(leaderW, leaderL, w, l) {
  const diff = ((leaderW - w) + (l - leaderL)) / 2;
  if (diff === 0) return "-";
  return diff % 1 === 0 ? diff.toString() : diff.toFixed(1);
}

function renderLegend(divKey) {
  const items = LEGEND_LINES[divKey] || [];
  const html = items.map(item => `
    <div class="legend-item">
      <div class="legend-swatch ${item.swatch}"></div>
      <span>${item.label}</span>
    </div>`).join("");
  return `<div class="legend">${html}</div>`;
}

function renderRegion(regionName, teams, expelledAbbr = null) {
  const sorted = [...teams].sort((a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)));
  const leader = sorted[0];

  const rows = sorted.map((t, i) => {
    let rowClass = "";
    if (i === 0) rowClass = "rank-1";
    else if (expelledAbbr ? t.abbr === expelledAbbr : i === sorted.length - 1) rowClass = "rank-bottom";

    const winPct   = t.w / (t.w + t.l);
    const barColor = winPct >= 0.55 ? "#3fb950" : winPct >= 0.45 ? "#58a6ff" : "#f85149";
    const barWidth = (winPct * 100).toFixed(1);

    return `
      <tr class="${rowClass}">
        <td><span class="team-abbr">${t.abbr}</span><span class="team-full">${t.city} ${t.name}</span></td>
        <td>${t.w}</td>
        <td>${t.l}</td>
        <td class="pct">
          ${pct(t.w, t.l)}
          <div class="pct-bar"><div class="pct-fill" style="width:${barWidth}%;background:${barColor}"></div></div>
        </td>
        <td>${gb(leader.w, leader.l, t.w, t.l)}</td>
      </tr>`;
  }).join("");

  return `
    <div class="region-card">
      <div class="region-header">${regionName}</div>
      <table>
        <thead>
          <tr>
            <th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderDivision(divKey) {
  const divData = ABL.divisions[divKey];
  if (!divData) {
    return `<div style="color:#8b949e;padding:40px;text-align:center;">
      Data for this division coming soon.
    </div>`;
  }

  // For Minors 2, find the single worst team across all regions
  let expelledAbbr = null;
  if (divKey === "minors2") {
    const allTeams = Object.values(divData.regions).flat();
    const worst = allTeams.reduce((a, b) => (a.w / (a.w + a.l)) <= (b.w / (b.w + b.l)) ? a : b);
    expelledAbbr = worst.abbr;
  }

  const regionCards = Object.entries(divData.regions)
    .map(([name, teams]) => renderRegion(name, teams, expelledAbbr))
    .join("");

  return `
    ${renderLegend(divKey)}
    <div class="division-block">
      <div class="regions-grid">${regionCards}</div>
    </div>`;
}

function renderTabs() {
  return `<div class="tab-bar">` +
    TAB_ORDER.map(key => {
      const cls = ["tab-btn", key === activeTab ? "active" : ""].filter(Boolean).join(" ");
      return `<button class="${cls}" data-tab="${key}">${TAB_LABELS[key]}</button>`;
    }).join("") +
  `</div>`;
}

function renderReserve() {
  const allTeams = Object.values(ABL_RESERVE.regions).flat();
  const callUpRand = window.ablSeededRand(window.ablSeed ^ 0xAE5E4111);
  const callUpAbbr = allTeams[Math.floor(callUpRand() * allTeams.length)].abbr;

  const regionCards = Object.entries(ABL_RESERVE.regions)
    .map(([name, teams]) => {
      const rows = teams.map(t => `
        <tr>
          <td>
            <span class="team-abbr">${t.abbr}</span>
            <span class="team-full">${t.city} ${t.name}</span>
            ${t.abbr === callUpAbbr ? '<span class="res-callup-badge">▲ CALL UP</span>' : ""}
          </td>
        </tr>`).join("");
      return `
        <div class="region-card">
          <div class="region-header">${name}</div>
          <table class="reserve-table">
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");

  return `
    <div class="division-block">
      <div class="regions-grid">${regionCards}</div>
    </div>`;
}

// ── Team Focus ───────────────────────────────────────────────────────────────

function getAllTeamsForFocus() {
  const list = [];
  for (const [divKey, div] of Object.entries(ABL.divisions)) {
    for (const [region, teams] of Object.entries(div.regions)) {
      for (const t of teams) list.push({ ...t, division: divKey, region });
    }
  }
  for (const [region, teams] of Object.entries(ABL_RESERVE.regions)) {
    for (const t of teams) list.push({ ...t, division: "reserve", region });
  }
  return list;
}

function renderTeamSelect() {
  const groups = [
    ["major",        "Major Division"],
    ["supplemental", "Supplemental"],
    ["minors1",      "Minors 1"],
    ["minors2",      "Minors 2"],
    ["reserve",      "Reserve League"],
  ];
  const allTeams = getAllTeamsForFocus();
  const optgroups = groups.map(([key, label]) => {
    const teams = allTeams.filter(t => t.division === key).sort((a, b) => a.city.localeCompare(b.city));
    const opts = teams.map(t =>
      `<option value="${t.abbr}"${t.abbr === selectedTeamAbbr ? " selected" : ""}>${t.city} ${t.name}</option>`
    ).join("");
    return `<optgroup label="${label}">${opts}</optgroup>`;
  }).join("");

  return `
    <select id="team-focus-select" class="team-focus-select">
      <option value="">— Select a team —</option>
      ${optgroups}
    </select>`;
}

function renderTeamCard(abbr) {
  const team = getAllTeamsForFocus().find(t => t.abbr === abbr);
  if (!team) return "";

  const divBadgeHTML = `<span class="tf-div-badge" style="color:${TF_DIV_COLORS[team.division]}">${TF_DIV_LABELS[team.division]}</span>`;

  if (team.division === "reserve") {
    return `
      <div class="tf-card">
        <div class="tf-header">
          <div class="tf-name">${team.city} ${team.name}</div>
          <div class="tf-sub">${divBadgeHTML} · ${team.region}</div>
        </div>
        <div class="tf-note">Reserve League teams don't play a simulated season — they're on standby for the Minors 2 call-up when a spot opens.</div>
      </div>`;
  }

  const divData      = ABL.divisions[team.division];
  const regionTeams  = divData.regions[team.region].map(t => ({ ...t, division: team.division, region: team.region }));
  const divTeams     = Object.entries(divData.regions).flatMap(([region, ts]) => ts.map(t => ({ ...t, division: team.division, region })));
  const regionSorted = [...regionTeams].sort((a, b) => tfPct(b) - tfPct(a));
  const divSorted    = [...divTeams].sort((a, b) => tfPct(b) - tfPct(a));
  const regionRank   = regionSorted.findIndex(t => t.abbr === abbr) + 1;
  const divRank      = divSorted.findIndex(t => t.abbr === abbr) + 1;
  const leader       = regionSorted[0];
  const gbVal        = gb(leader.w, leader.l, team.w, team.l);
  const winPct       = tfPct(team);
  const barColor     = winPct >= 0.55 ? "#3fb950" : winPct >= 0.45 ? "#58a6ff" : "#f85149";

  let status = "—", statusClass = "";
  if (team.division === "major") {
    if (regionRank === 1) { status = "Region Winner — Championship Qualifier"; statusClass = "tf-status-good"; }
  } else if (team.division === "minors2") {
    const isExpelled = divSorted[divSorted.length - 1].abbr === abbr;
    if (regionRank === 1)        { status = "Automatic Promotion to Minors 1"; statusClass = "tf-status-good"; }
    else if (regionRank <= 5)    { status = "Promotion Tournament Berth";      statusClass = "tf-status-mid";  }
    else if (isExpelled)         { status = "Worst Record — Expelled from ABL"; statusClass = "tf-status-bad"; }
  } else {
    const promoteTo = team.division === "supplemental" ? "Major" : "Supplemental";
    const isLastInRegion = regionRank === regionTeams.length;
    if (regionRank === 1)        { status = `Automatic Promotion to ${promoteTo}`; statusClass = "tf-status-good"; }
    else if (regionRank <= 5)    { status = "Promotion Tournament Berth";          statusClass = "tf-status-mid";  }
    else if (isLastInRegion)     { status = "Relegation Candidate";                statusClass = "tf-status-bad";  }
  }

  return `
    <div class="tf-card">
      <div class="tf-header">
        <div class="tf-name">${team.city} ${team.name}</div>
        <div class="tf-sub">${divBadgeHTML} · ${team.region}</div>
      </div>

      <div class="tf-record-row">
        <div class="tf-record-main">${team.w}–${team.l}</div>
        <div class="tf-record-pct">${pct(team.w, team.l)}</div>
      </div>
      <div class="tf-pct-bar"><div class="tf-pct-fill" style="width:${(winPct*100).toFixed(1)}%;background:${barColor}"></div></div>

      <div class="tf-stats-grid">
        <div class="tf-stat">
          <div class="tf-stat-label">Region Rank</div>
          <div class="tf-stat-value">${regionRank} of ${regionTeams.length}</div>
        </div>
        <div class="tf-stat">
          <div class="tf-stat-label">Division Rank</div>
          <div class="tf-stat-value">${divRank} of ${divTeams.length}</div>
        </div>
        <div class="tf-stat">
          <div class="tf-stat-label">Games Behind</div>
          <div class="tf-stat-value">${gbVal}</div>
        </div>
      </div>

      <div class="tf-status ${statusClass}">${status}</div>

      ${renderTeamGameLog(abbr)}
    </div>`;
}

function renderTeamGameLog(abbr) {
  const games = (window.ablGames || []).filter(g => g.homeAbbr === abbr || g.awayAbbr === abbr);
  if (!games.length) return "";

  const rows = games.map(g => {
    const isHome = g.homeAbbr === abbr;
    const oppAbbr = isHome ? g.awayAbbr : g.homeAbbr;
    const ownScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    const won = ownScore > oppScore;
    return `
      <div class="tf-game-row${won ? " tf-game-win" : " tf-game-loss"}">
        <span class="tf-game-date">${g.date}</span>
        <span class="tf-game-type">${g.type}</span>
        <span class="tf-game-vs">${isHome ? "vs" : "@"} ${oppAbbr}</span>
        <span class="tf-game-result">${won ? "W" : "L"}</span>
        <span class="tf-game-score">${ownScore}–${oppScore}</span>
      </div>`;
  }).join("");

  return `
    <div class="tf-gamelog">
      <div class="tf-gamelog-header">Season Calendar <span class="tf-gamelog-sub">${games.length} games</span></div>
      <div class="tf-gamelog-list">${rows}</div>
    </div>`;
}

function renderTeamFocus() {
  const body = selectedTeamAbbr
    ? renderTeamCard(selectedTeamAbbr)
    : `<div class="tf-empty">Pick a team above to see its season at a glance.</div>`;

  return `
    <div class="tf-wrap">
      ${renderTeamSelect()}
      ${body}
    </div>`;
}

function render() {
  const app = document.getElementById("app");
  const content = activeTab === "promorel"
    ? renderPromoRel()
    : activeTab === "reserve"
    ? renderReserve()
    : activeTab === "team"
    ? renderTeamFocus()
    : renderDivision(activeTab);
  app.innerHTML = renderTabs() + content;

  app.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  const select = app.querySelector("#team-focus-select");
  if (select) {
    select.addEventListener("change", () => {
      selectedTeamAbbr = select.value || null;
      render();
    });
  }
}

render();
