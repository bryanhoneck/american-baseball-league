let activeTab = "major";

const TAB_ORDER = ["major", "supplemental", "minors1", "minors2", "reserve", "promorel"];
const TAB_LABELS = {
  major:       "Major Division",
  supplemental:"Supplemental",
  minors1:     "Minors 1",
  minors2:     "Minors 2",
  reserve:     "Reserve",
  promorel:    "Prom / Rel",
};

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
          <table>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");

  return `
    <div class="division-block">
      <div class="regions-grid">${regionCards}</div>
    </div>`;
}

function render() {
  const app = document.getElementById("app");
  const content = activeTab === "promorel"
    ? renderPromoRel()
    : activeTab === "reserve"
    ? renderReserve()
    : renderDivision(activeTab);
  app.innerHTML = renderTabs() + content;

  app.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });
}

render();
