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

// ── League Map ───────────────────────────────────────────────────────────────
// Warm-to-cool ramp: Major pops (hot, large, opaque), Reserve recedes (cool, small, faint)
const MAP_DIV_COLORS  = { major: "#ff5c4d", supplemental: "#f0a93a", minors1: "#58a6ff", minors2: "#3d6a96", reserve: "#4a5568" };
const MAP_DIV_RADIUS   = { major: 6,         supplemental: 5.2,      minors1: 4.6,       minors2: 4,         reserve: 3.4 };
const MAP_DIV_OPACITY  = { major: 1,         supplemental: 0.95,     minors1: 0.85,      minors2: 0.75,      reserve: 0.6 };
const MAP_DIV_LABELS = { major: "Major Division", supplemental: "Supplemental", minors1: "Minors 1", minors2: "Minors 2", reserve: "Reserve Pool" };

const MAP_TEAM_COORDS = {
  // Major
  LAD:[34.05,-118.24], SD:[32.72,-117.16], SEA:[47.61,-122.33], SF:[37.77,-122.42], OAK:[37.80,-122.27], LAA:[33.80,-117.88],
  PHI:[39.95,-75.16], NYY:[40.75,-73.99], BAL:[39.29,-76.61], NYM:[40.75,-73.85], BOS:[42.36,-71.06], WSH:[38.91,-77.04],
  MIL:[43.04,-87.91], CHC:[41.95,-87.66], STL:[38.63,-90.20], CIN:[39.10,-84.51], PIT:[40.44,-79.99], COL:[39.74,-104.99],
  CLE:[41.50,-81.69], DET:[42.33,-83.05], KC:[39.10,-94.58], MIN:[44.98,-93.27], TOR:[43.65,-79.38], CWS:[41.83,-87.63],
  ATL:[33.75,-84.39], ARI:[33.45,-112.07], HOU:[29.76,-95.37], MEM:[35.15,-90.05], TEX:[32.75,-97.08], MIA:[25.76,-80.19],
  // Supplemental
  RNO:[39.53,-119.81], TAC:[47.25,-122.44], SAC:[38.58,-121.49], LV:[36.17,-115.14], SLC:[40.76,-111.89], ABQ:[35.08,-106.65],
  LHV:[40.61,-75.49], SWB:[41.34,-75.74], NOR:[36.85,-76.29], SYR:[43.05,-76.15], WOR:[42.26,-71.80], ROC:[43.16,-77.61],
  OKC:[35.47,-97.51], NAS:[36.16,-86.78], OMA:[41.26,-95.94], TBR:[27.95,-82.46], LOU:[38.25,-85.76], CLT:[35.23,-80.84],
  CLB:[39.96,-82.99], TOL:[41.65,-83.54], STP:[44.95,-93.09], IOW:[41.59,-93.62], BUF:[42.89,-78.88], IND:[39.77,-86.16],
  ELP:[31.76,-106.49], GWN:[33.96,-83.99], SL:[29.62,-95.63], DUR:[35.99,-78.90], RR:[30.51,-97.68], JAX:[30.33,-81.66],
  // Minors 1
  TUL:[36.15,-95.99], AMA:[35.22,-101.83], SA:[29.42,-98.49], NWA:[36.19,-94.13], ARK:[34.75,-92.26], MID:[31.99,-102.08],
  SOM:[40.57,-74.62], REA:[40.34,-75.93], BOW:[39.00,-76.77], HFD:[41.76,-72.67], POR:[43.66,-70.26], NH:[42.99,-71.46],
  TNS:[35.97,-83.58], WCH:[37.69,-97.34], SPC:[37.21,-93.30], MTG:[32.37,-86.30], CHA:[35.05,-85.31], RCT:[34.74,-86.75],
  AKR:[41.08,-81.52], BNG:[42.10,-75.91], ERI:[42.13,-80.09], RIC:[37.54,-77.44], HAR:[40.27,-76.88], ALT:[40.52,-78.40],
  MIS:[32.29,-90.13], BLX:[30.40,-88.89], FRI:[33.15,-96.82], CC:[27.80,-97.40], PNS:[30.42,-87.22], BHM:[33.52,-86.80],
  // Minors 2
  HBG:[45.52,-122.99], EVE:[47.98,-122.20], VAN:[49.28,-123.12], EUG:[44.05,-123.09], SPO:[47.66,-117.43], TCY:[46.24,-119.10],
  JSH:[40.06,-74.18], HV:[41.59,-73.93], BRK:[40.65,-73.95], ABD:[39.51,-76.16], GVL:[34.85,-82.40], WIL:[39.74,-75.55],
  WIS:[44.27,-88.50], QC:[41.52,-90.58], PEO:[40.69,-89.59], SBN:[41.68,-86.25], CDR:[41.98,-91.67], BEL:[42.51,-89.03],
  GL:[43.62,-84.25], LC:[41.66,-81.45], FW:[41.08,-85.14], WMI:[43.02,-85.67], DAY:[39.76,-84.19], LAN:[42.73,-84.55],
  ROM:[34.26,-85.16], ASH:[35.60,-82.55], BG:[36.99,-86.44], HIC:[35.73,-81.34], GBO:[36.07,-79.79], WS:[36.10,-80.24],
  // Reserve
  SJS:[37.34,-121.89], FRE:[36.75,-119.77], LBC:[33.77,-118.19], BKF:[35.37,-119.02], STK:[37.96,-121.29], TUS:[32.22,-110.97],
  MSA:[33.42,-111.83], BOI:[43.62,-116.20], HND:[36.04,-114.98], PDX:[45.52,-122.68], TPA:[27.95,-82.46], ORL:[28.54,-81.38],
  SPB:[27.77,-82.64], FTL:[26.12,-80.14], TLH:[30.44,-84.28], RAL:[35.78,-78.64], VIR:[36.85,-75.98], AGS:[33.47,-81.97],
  SAV:[32.08,-81.10], MOB:[30.69,-88.04], AUT:[30.27,-97.74], LRD:[27.51,-99.51], LBB:[33.58,-101.86], PLA:[33.02,-96.70],
  NOL:[29.95,-90.07], BTR:[30.45,-91.15], SHV:[32.53,-93.75], LAF:[30.22,-92.02], COS:[38.83,-104.82], JKS:[32.30,-90.18],
  GRR:[42.96,-85.67], MAD:[43.07,-89.40], DSM:[41.59,-93.62], SFS:[43.55,-96.73], FGO:[46.88,-96.79], GBW:[44.51,-88.02],
  KVL:[35.96,-83.92], LNK:[40.81,-96.68], EVS:[37.97,-87.56], ANN:[42.28,-83.74], LEX:[38.04,-84.50], SCO:[33.49,-111.93],
  CHL:[33.31,-111.84], ALB:[42.65,-73.75], CLM:[34.00,-81.03], NHV:[41.31,-72.93], HNL:[21.31,-157.86], ANC:[61.22,-149.90],
  PRV:[40.23,-111.66], AUR:[39.73,-104.83],
};

function getAllLeagueTeamsForMap() {
  const teams = [];
  Object.entries(ABL.divisions).forEach(([divKey, divData]) => {
    Object.values(divData.regions).forEach(regionTeams => {
      regionTeams.forEach(t => teams.push({ ...t, division: divKey }));
    });
  });
  Object.values(ABL_RESERVE.regions).forEach(regionTeams => {
    regionTeams.forEach(t => teams.push({ ...t, division: "reserve" }));
  });
  return teams;
}

function renderMapLegend() {
  return Object.keys(MAP_DIV_LABELS).map(key => {
    const size = MAP_DIV_RADIUS[key] * 2;
    return `
    <div class="map-legend-item">
      <span class="map-legend-dot" style="background:${MAP_DIV_COLORS[key]};opacity:${MAP_DIV_OPACITY[key]};width:${size}px;height:${size}px"></span>
      <span>${MAP_DIV_LABELS[key]}</span>
    </div>`;
  }).join("");
}

function renderUSMap() {
  const teams = getAllLeagueTeamsForMap();

  return `
    <div class="home-map-section">
      <div class="home-section-label">Where the ABL Plays</div>
      <p class="home-map-desc">
        The American Baseball League fields teams from coast to coast — anchored along the
        I-95 corridor and Great Lakes, spread through the South and Texas, and reaching into
        the Mountain West, Pacific Coast, Alaska, and Hawaii — ${teams.length} cities in all,
        including the 50-team Reserve Pool that competes each year for a single promotion
        spot into Minors 2.
      </p>
      <div class="home-map-svg-wrap" id="us-map-wrap">
        <div class="map-legend-overlay">${renderMapLegend()}</div>
        <div class="map-tooltip" id="map-tooltip"></div>
      </div>
    </div>`;
}

async function drawUSMap() {
  const wrap = document.getElementById("us-map-wrap");
  if (!wrap || typeof d3 === "undefined" || typeof topojson === "undefined") return;

  try {
    const width = 975, height = 610;
    const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");
    const states = topojson.feature(us, us.objects.states);
    const borders = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

    const projection = d3.geoAlbersUsa().scale(1300).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const svg = d3.create("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("class", "home-map-svg");

    svg.append("g")
      .selectAll("path")
      .data(states.features)
      .join("path")
      .attr("d", path)
      .attr("class", "map-state");

    svg.append("path")
      .attr("d", path(borders))
      .attr("class", "map-state-borders");

    const tooltip = document.getElementById("map-tooltip");

    const pinsGroup = svg.append("g");
    const tierOrder = ["reserve", "minors2", "minors1", "supplemental", "major"];
    const teamsByTier = getAllLeagueTeamsForMap()
      .sort((a, b) => tierOrder.indexOf(a.division) - tierOrder.indexOf(b.division));

    teamsByTier.forEach(t => {
      const coord = MAP_TEAM_COORDS[t.abbr];
      if (!coord) return;
      const p = projection([coord[1], coord[0]]);
      if (!p) return;
      pinsGroup.append("circle")
        .attr("cx", p[0]).attr("cy", p[1])
        .attr("r", MAP_DIV_RADIUS[t.division])
        .attr("class", "map-pin")
        .attr("fill", MAP_DIV_COLORS[t.division])
        .attr("opacity", MAP_DIV_OPACITY[t.division])
        .on("mouseenter", function (event) {
          d3.select(this).raise().classed("map-pin-hover", true);
          if (!tooltip) return;
          tooltip.innerHTML = `
            <span class="map-tooltip-team">${t.city} ${t.name}</span>
            <span class="map-tooltip-div" style="color:${MAP_DIV_COLORS[t.division]}">${MAP_DIV_LABELS[t.division]}</span>`;
          tooltip.classList.add("visible");
        })
        .on("mousemove", function (event) {
          if (!tooltip) return;
          const rect = wrap.getBoundingClientRect();
          tooltip.style.left = (event.clientX - rect.left + 14) + "px";
          tooltip.style.top = (event.clientY - rect.top - 10) + "px";
        })
        .on("mouseleave", function () {
          d3.select(this).classed("map-pin-hover", false);
          if (tooltip) tooltip.classList.remove("visible");
        });
    });

    wrap.insertBefore(svg.node(), wrap.firstChild);
  } catch (err) {
    wrap.innerHTML = `<p style="color:#8b949e;padding:20px;text-align:center;">Map data unavailable.</p>`;
  }
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
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

    ${renderUSMap()}

    <div class="home-section-label">Season Calendar</div>

    ${renderCalendarGrid()}
  `;
}

render();
drawUSMap();
