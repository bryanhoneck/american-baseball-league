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

// ── Circular Season Calendar ───────────────────────────────────────────────
function renderCalendarRing() {
  const W = 600, H = 582, CX = 300, CY = 270;
  const RO = 210, RI = 150, RM = 234;
  const f = v => v.toFixed(2);

  function pt(b, r) {
    const rad = (b - 90) * Math.PI / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  }

  // Cumulative days per month (non-leap year)
  const MD = [0,31,59,90,120,151,181,212,243,273,304,334,365];
  function bear(m, d) { return (MD[m-1] + d - 1) / 365 * 360; }

  function arcSeg(b1, b2, ro, ri, fill) {
    if (b2 - b1 < 0.1) return "";
    const [ax,ay]=pt(b1,ro), [bx,by]=pt(b2,ro);
    const [cx,cy]=pt(b2,ri), [dx,dy]=pt(b1,ri);
    const lg = b2 - b1 > 180 ? 1 : 0;
    return `<path d="M${f(ax)},${f(ay)} A${ro},${ro} 0 ${lg},1 ${f(bx)},${f(by)} L${f(cx)},${f(cy)} A${ri},${ri} 0 ${lg},0 ${f(dx)},${f(dy)} Z" fill="${fill}" stroke="#0d1117" stroke-width="0.5"/>`;
  }

  function outerAnchor(b) {
    const n = ((b % 360) + 360) % 360;
    if (n < 14 || n > 346) return "middle";
    return n < 170 ? "start" : n > 190 ? "end" : "middle";
  }
  function innerAnchor(b) {
    const n = ((b % 360) + 360) % 360;
    if (n < 14 || n > 346) return "middle";
    return n < 170 ? "end" : n > 190 ? "start" : "middle";
  }

  const IL        = "#0a2040";
  const REGIONAL  = "#082810";
  const SPRING    = "#2a1e00";
  const FA        = "#200a40";
  const CUP_BREAK = "#3a0808";
  const CHAMP     = "#2a1e00";
  const FINAL_DAY = "#6a4a00";
  const OFFSEASON = "#0d1117";

  // ─ Arc segments (Jan1=0°, clockwise, Dec31≈359°) ─────────────────────────
  let svg = "";
  const segs = [
    [bear(1,1),  bear(2,1),  OFFSEASON],   // Winter offseason
    [bear(2,1),  bear(2,8),  "#18083a"],   // FA — new teams
    [bear(2,8),  bear(3,1),  FA],          // FA — rest of ABL
    [bear(3,1),  bear(4,1),  SPRING],      // Spring Training
    [bear(4,1),  bear(4,15), "#0d1520"],   // Pre-season (Cup R1 Apr 5–6)
    [bear(4,15), bear(4,28), IL],          // IL — Opening Day + Apr 21–27
    [bear(4,28), bear(5,20), REGIONAL],    // Regional — 3 weeks
    [bear(5,20), bear(6,9),  IL],          // IL — 3 weeks
    [bear(6,9),  bear(6,23), REGIONAL],    // Regional — 2 weeks
    [bear(6,23), bear(6,30), IL],          // IL — Jun 23–29
    [bear(6,30), bear(7,7),  CUP_BREAK],  // ⚾ Cup Break (R6–R8)
    [bear(7,7),  bear(7,20), IL],          // IL — Jul 7–19
    [bear(7,20), bear(8,11), REGIONAL],    // Regional — Jul 20–Aug 10
    [bear(8,11), bear(9,1),  IL],          // IL — Aug 11–31
    [bear(9,1),  bear(9,8),  REGIONAL],    // Regional — Sep 1–7
    [bear(9,8),  bear(9,15), IL],          // IL — Sep 8–14
    [bear(9,15), bear(9,22), REGIONAL],    // Regional — Sep 15–21
    [bear(9,22), bear(10,6), CHAMP],       // Championship QF + SF
    [bear(10,6), bear(10,7), FINAL_DAY],   // Final day
    [bear(10,7), 359.9,      OFFSEASON],   // Post-season
  ];
  segs.forEach(([b1,b2,c]) => { svg += arcSeg(b1, b2, RO, RI, c); });

  // Inner fill
  svg += `<circle cx="${CX}" cy="${CY}" r="${RI}" fill="#090d12"/>`;

  // ─ Month dividers + labels ────────────────────────────────────────────────
  const MNAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  for (let m = 1; m <= 12; m++) {
    const b = bear(m, 1);
    const [xo,yo] = pt(b, RO+3), [xi,yi] = pt(b, RI);
    svg += `<line x1="${f(xo)}" y1="${f(yo)}" x2="${f(xi)}" y2="${f(yi)}" stroke="#1c2230" stroke-width="0.75"/>`;
    const midDoy = MD[m-1] + Math.round((MD[m] - MD[m-1]) / 2);
    const mb = (midDoy - 0.5) / 365 * 360;
    const [mx,my] = pt(mb, RM);
    svg += `<text x="${f(mx)}" y="${f(my)}" fill="#3a4252" font-size="7.5" text-anchor="middle" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-weight="600" letter-spacing="0.5">${MNAMES[m-1]}</text>`;
  }

  // ─ Boundary ticks ─────────────────────────────────────────────────────────
  function tick(m, d, color, sw=1.75) {
    const b = bear(m, d);
    const [xo,yo] = pt(b, RO+7), [xi,yi] = pt(b, RI-5);
    return `<line x1="${f(xo)}" y1="${f(yo)}" x2="${f(xi)}" y2="${f(yi)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  function outerLbl(m, d, text, color, rOff=22) {
    const b = bear(m, d);
    const [x,y] = pt(b, RO+rOff);
    return `<text x="${f(x)}" y="${f(y)}" fill="${color}" font-size="7.5" text-anchor="${outerAnchor(b)}" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-weight="700">${text}</text>`;
  }

  svg += tick(2,  1,  "#7c3aed");
  svg += tick(3,  1,  "#b45309");
  svg += tick(4, 15,  "#2563eb", 2.5);
  svg += tick(6, 30,  "#dc2626", 2.5);
  svg += tick(7,  7,  "#2563eb");
  svg += tick(9, 22,  "#b45309", 2.5);
  svg += tick(9, 29,  "#b45309");
  svg += tick(10, 6,  "#d97706", 2.5);
  svg += tick(10, 7,  "#b45309");

  svg += outerLbl(2,  7, "Free Agency",    "#a78bfa");
  svg += outerLbl(3, 17, "Spring Training","#d97706");
  svg += outerLbl(4, 15, "Opening Day",    "#60a5fa", 20);
  svg += outerLbl(7,  3, "Cup Break",      "#f87171", 24);
  svg += outerLbl(7,  2, "R6–R8",          "#ef4444", 36);
  svg += outerLbl(9, 25, "QF",            "#d97706");
  svg += outerLbl(10, 2, "SF",            "#d97706");
  svg += outerLbl(10, 6, "Final",         "#f59e0b");

  // ─ Cup Round inward ticks (R1–R5) ─────────────────────────────────────────
  function cupRound(m, d, label) {
    const b = bear(m, d);
    const [xo,yo] = pt(b, RI-3), [xi,yi] = pt(b, RI-18);
    const [lx,ly] = pt(b, RI-28);
    const a = innerAnchor(b);
    return `<line x1="${f(xo)}" y1="${f(yo)}" x2="${f(xi)}" y2="${f(yi)}" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
<text x="${f(lx)}" y="${f(ly)}" fill="#ef4444" font-size="6.5" text-anchor="${a}" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-weight="700">${label}</text>`;
  }

  svg += cupRound(4,  5, "R1");
  svg += cupRound(5,  5, "R2");
  svg += cupRound(5, 19, "R3");
  svg += cupRound(6,  1, "R4");
  svg += cupRound(6, 16, "R5");

  // ─ Center label ───────────────────────────────────────────────────────────
  svg += `
    <text x="${CX}" y="${CY-16}" fill="#f0f6fc" font-size="20" text-anchor="middle" dominant-baseline="middle" font-family="'Bebas Neue',sans-serif" letter-spacing="3">ABL</text>
    <text x="${CX}" y="${CY+6}" fill="#6e7681" font-size="7" text-anchor="middle" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-weight="700" letter-spacing="1.5">SEASON</text>
    <text x="${CX}" y="${CY+18}" fill="#6e7681" font-size="7" text-anchor="middle" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif" font-weight="700" letter-spacing="1.5">CALENDAR</text>`;

  // ─ Legend ─────────────────────────────────────────────────────────────────
  const LY = CY + RO + 44;
  const legItems = [
    [IL,        "Interleague (IL)"],
    [REGIONAL,  "Regional"],
    [SPRING,    "Spring Training"],
    [CUP_BREAK, "Cup Break"],
    [CHAMP,     "Championship"],
    [FA,        "Free Agency"],
  ];
  legItems.forEach(([c, t], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const lx = 32 + col * 182, ly = LY + row * 16;
    svg += `<rect x="${lx}" y="${ly-5}" width="10" height="10" fill="${c}" rx="2"/>
<text x="${lx+13}" y="${ly}" fill="#6e7681" font-size="9" dominant-baseline="middle" font-family="'Barlow Condensed',sans-serif">${t}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:520px;display:block;margin:0 auto">${svg}</svg>`;
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

    ${renderCalendarRing()}
  `;
}

render();
