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
const DIV_COLORS = { major: "#58a6ff", supplemental: "#3fb950", minors1: "#d29922", minors2: "#8b949e" };

function pctDisplay(t) { return (teamPct(t) * 100).toFixed(1) + "%"; }

// ── Season Calendar (traditional month grid) ───────────────────────────────
function renderCalendarGrid() {
  const YEAR = 2026; // non-leap — used only for weekday layout

  const TYPE_STYLE = {
    fa:       { bg: "#241246", fg: "#c9b3f0" },
    spring:   { bg: "#3a2900", fg: "#f0b429" },
    il:       { bg: "#0d2c54", fg: "#8ec2ff" },
    regional: { bg: "#0d3420", fg: "#7be3a3" },
    cupbreak: { bg: "#4a1414", fg: "#ff9999" },
    champ:    { bg: "#3d1f00", fg: "#fb923c" },
    off:      { bg: "#161b22", fg: "#6e7681" },
  };

  const dayInfo = {};
  function fillRange(m1, d1, m2, d2, type) {
    let date = new Date(YEAR, m1 - 1, d1);
    const end = new Date(YEAR, m2 - 1, d2);
    while (date <= end) {
      const key = `${date.getMonth()+1}-${date.getDate()}`;
      dayInfo[key] = { ...(dayInfo[key] || {}), type };
      date.setDate(date.getDate() + 1);
    }
  }
  function markEvent(m, d, label, color) {
    const key = `${m}-${d}`;
    dayInfo[key] = { ...(dayInfo[key] || {}), event: label, eventColor: color };
  }

  fillRange(1,1,   1,31,  "off");
  fillRange(2,1,   2,28,  "fa");
  fillRange(3,1,   3,31,  "spring");
  fillRange(4,1,   4,14,  "off");
  fillRange(4,15,  4,27,  "il");
  fillRange(4,28,  5,18,  "regional");
  fillRange(5,20,  6,8,   "il");
  fillRange(6,9,   6,22,  "regional");
  fillRange(6,23,  6,29,  "il");
  fillRange(6,30,  7,6,   "cupbreak");
  fillRange(7,7,   7,19,  "il");
  fillRange(7,20,  8,10,  "regional");
  fillRange(8,11,  8,31,  "il");
  fillRange(9,1,   9,7,   "regional");
  fillRange(9,8,   9,14,  "il");
  fillRange(9,15,  9,21,  "regional");
  fillRange(9,22, 10,6,   "champ");
  fillRange(10,7, 12,31,  "off");

  markEvent(2,  1, "Free Agency opens — new teams",   "#a78bfa");
  markEvent(2,  8, "Free Agency opens — rest of ABL", "#a78bfa");
  markEvent(4,  5, "Baseball Cup R1",                 "#ef4444");
  markEvent(4,  6, "Baseball Cup R1",                 "#ef4444");
  markEvent(4, 15, "Opening Day",                     "#60a5fa");
  markEvent(5,  5, "Baseball Cup R2",                 "#ef4444");
  markEvent(5, 19, "Baseball Cup R3",                 "#ef4444");
  markEvent(6,  1, "Baseball Cup R4",                 "#ef4444");
  markEvent(6, 16, "Baseball Cup R5",                 "#ef4444");
  markEvent(6, 30, "Baseball Cup R6",                 "#ef4444");
  markEvent(7,  2, "Baseball Cup R7",                 "#ef4444");
  markEvent(7,  4, "Baseball Cup R8",                 "#ef4444");
  markEvent(9, 22, "Championship Quarterfinals begin","#fb923c");
  markEvent(9, 29, "Championship Semifinals begin",   "#fb923c");
  markEvent(10, 6, "Championship Final",              "#f59e0b");

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const WD = ["S","M","T","W","T","F","S"];

  function renderMonth(m) {
    const firstDay = new Date(YEAR, m - 1, 1);
    const daysInMonth = new Date(YEAR, m, 0).getDate();
    const startWeekday = firstDay.getDay();

    let cells = "";
    for (let i = 0; i < startWeekday; i++) cells += `<div class="cal-day cal-day-empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const info = dayInfo[`${m}-${d}`] || {};
      const style = TYPE_STYLE[info.type || "off"];
      const dot = info.event ? `<span class="cal-day-dot" style="background:${info.eventColor}"></span>` : "";
      const ring = info.event ? " cal-day-event" : "";
      const tip = info.event ? ` title="${MONTH_NAMES[m-1]} ${d} — ${info.event}"` : "";
      cells += `<div class="cal-day${ring}" style="background:${style.bg};color:${style.fg}"${tip}>
        <span class="cal-day-num">${d}</span>${dot}
      </div>`;
    }

    return `
      <div class="cal-month-card">
        <div class="cal-month-header">${MONTH_NAMES[m-1]}</div>
        <div class="cal-weekday-row">${WD.map(w => `<span>${w}</span>`).join("")}</div>
        <div class="cal-days-grid">${cells}</div>
      </div>`;
  }

  const months = [];
  for (let m = 1; m <= 12; m++) months.push(renderMonth(m));

  const legend = [
    [TYPE_STYLE.il.bg,       "Interleague (IL)"],
    [TYPE_STYLE.regional.bg, "Regional"],
    [TYPE_STYLE.spring.bg,   "Spring Training"],
    [TYPE_STYLE.fa.bg,       "Free Agency"],
    [TYPE_STYLE.cupbreak.bg, "Baseball Cup Break"],
    [TYPE_STYLE.champ.bg,    "Championship"],
  ].map(([c, t]) => `
    <div class="cal-legend-item">
      <div class="cal-legend-swatch" style="background:${c}"></div>
      <span>${t}</span>
    </div>`).join("");

  return `
    <div class="cal-grid-wrap">
      <div class="cal-months-grid">${months.join("")}</div>
      <div class="cal-legend">${legend}</div>
    </div>`;
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  const teams = getAllTeams().sort((a, b) => teamPct(b) - teamPct(a));

  const best       = teams[0];
  const worst      = teams[teams.length - 1];
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

  document.getElementById("home-app").innerHTML = `
    <div class="home-hero">
      <p class="home-tagline">120 teams. 4 divisions. One champion.</p>
      <p class="home-desc">
        The American Baseball League is a professional baseball organization featuring
        120 teams across four competitive divisions — Major, Supplemental, Minors 1,
        and Minors 2. Teams compete in five regional conferences each season, battling
        for promotion, fighting off relegation, and chasing glory in the Baseball Cup.
        Each 54-game regular season culminates in the Baseball Cup tournament and the
        Championship, where the best Major Division teams compete for the title.
      </p>
    </div>

    <div class="home-section-label">Season Snapshot · 54 Games</div>

    <div class="home-stats-grid">
      <div class="home-stat-card">
        <div class="hsc-label">Best Record</div>
        <div class="hsc-value">${best.city} ${best.name}</div>
        <div class="hsc-sub">
          <span style="color:${DIV_COLORS[best.division]}">${DIV_LABELS[best.division]}</span>
          · ${best.w}–${best.l} · ${pctDisplay(best)}
        </div>
      </div>
      <div class="home-stat-card">
        <div class="hsc-label">Worst Record</div>
        <div class="hsc-value">${worst.city} ${worst.name}</div>
        <div class="hsc-sub">
          <span style="color:${DIV_COLORS[worst.division]}">${DIV_LABELS[worst.division]}</span>
          · ${worst.w}–${worst.l} · ${pctDisplay(worst)}
        </div>
      </div>
      <div class="home-stat-card">
        <div class="hsc-label">Top Minors 2 Team</div>
        <div class="hsc-value">${minors2Best.city} ${minors2Best.name}</div>
        <div class="hsc-sub">
          <span style="color:${DIV_COLORS.minors2}">Minors 2</span>
          · ${minors2Best.w}–${minors2Best.l} · ${pctDisplay(minors2Best)}
        </div>
      </div>
      <div class="home-stat-card">
        <div class="hsc-label">Tightest Race</div>
        <div class="hsc-value">${tightestRegion.name}</div>
        <div class="hsc-sub">
          <span style="color:${DIV_COLORS[tightestRegion.divKey]}">${DIV_LABELS[tightestRegion.divKey]}</span>
          · ${(tightestRegion.spread * 100).toFixed(1)}% spread top–bottom
        </div>
      </div>
    </div>

    <div class="home-section-label">Season Leaders</div>

    <div class="home-leaders">
      ${teams.slice(0, 5).map((t, i) => {
        const wp = teamPct(t);
        const barColor = wp >= 0.55 ? "#3fb950" : wp >= 0.45 ? "#58a6ff" : "#f85149";
        return `
          <div class="leader-row">
            <span class="leader-rank">#${i + 1}</span>
            <span class="leader-info">
              <span class="leader-name">${t.city} ${t.name}</span>
              <span class="leader-record">${t.w}–${t.l}</span>
            </span>
            <span class="leader-div" style="color:${DIV_COLORS[t.division]}">${DIV_LABELS[t.division]}</span>
            <span class="leader-bar-wrap">
              <span class="leader-bar-track">
                <span class="leader-bar-fill" style="width:${(wp*100).toFixed(1)}%;background:${barColor}"></span>
              </span>
              <span class="leader-pct">${pctDisplay(t)}</span>
            </span>
          </div>`;
      }).join("")}
    </div>

    <div class="home-section-label">Season Calendar</div>

    ${renderCalendarGrid()}
  `;
}

render();
