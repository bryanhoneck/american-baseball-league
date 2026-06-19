let selectedTeamAbbr = null;
let chartRegistry = [];

const TF_DIV_LABELS = { major: "MAJ", supplemental: "SUP", minors1: "M1", minors2: "M2", reserve: "RES" };
const TF_DIV_COLORS = { major: "#58a6ff", supplemental: "#3fb950", minors1: "#d29922", minors2: "#8b949e", reserve: "#8b5cf6" };
function tfPct(t) { return t.w / (t.w + t.l); }

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
  const selected = allTeams.find(t => t.abbr === selectedTeamAbbr);

  const groupsHTML = groups.map(([key, label]) => {
    const teams = allTeams.filter(t => t.division === key).sort((a, b) => a.city.localeCompare(b.city));
    const items = teams.map(t => {
      const record = t.division === "reserve" ? "" : `<span class="tf-team-opt-record">${t.w}-${t.l}</span>`;
      return `
        <div class="tf-team-opt${t.abbr === selectedTeamAbbr ? " is-selected" : ""}" data-abbr="${t.abbr}" data-search="${(t.city + " " + t.name).toLowerCase()}">
          <span class="tf-team-opt-dot" style="background:${TF_DIV_COLORS[key]}"></span>
          <span class="tf-team-opt-name">${t.city} ${t.name}</span>
          ${record}
        </div>`;
    }).join("");
    return `<div class="tf-team-group"><div class="tf-team-group-label">${label}</div>${items}</div>`;
  }).join("");

  return `
    <div class="tf-team-picker" id="tf-team-picker">
      <input
        type="text"
        id="tf-team-search"
        class="tf-team-search"
        placeholder="Search for a team..."
        autocomplete="off"
        value="${selected ? `${selected.city} ${selected.name}` : ""}"
      />
      <div class="tf-team-dropdown" id="tf-team-dropdown" hidden>${groupsHTML}</div>
    </div>`;
}

function renderTeamSummary(abbr) {
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
    </div>`;
}

function renderTeamDetails(abbr) {
  const team = getAllTeamsForFocus().find(t => t.abbr === abbr);
  if (!team || team.division === "reserve") return "";

  return `
    ${renderRegionLineChart(team, (g, isHome) => (isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore) ? 1 : 0, "Wins Over Season")}
    ${renderRegionLineChart(team, (g, isHome) => isHome ? g.homeScore - g.awayScore : g.awayScore - g.homeScore, "Run Differential Over Season")}
    ${renderTeamGameLog(abbr)}`;
}

const TF_PALETTE = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#8b5cf6", "#f0883e", "#39c5cf", "#db61a2"];

function renderRegionLineChart(team, valueFn, title) {
  const divData = ABL.divisions[team.division];
  const regionTeams = divData.regions[team.region].map(t => ({ ...t, division: team.division, region: team.region }));
  const allGames = window.ablGames || [];
  if (!allGames.length || !regionTeams.length) return "";

  const globalMin = allGames[0].sortKey;
  const globalMax = allGames[allGames.length - 1].sortKey;

  const W = 640, H = 220, padL = 30, padR = 70, padT = 14, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xAt = k => padL + innerW * (k - globalMin) / (globalMax - globalMin);

  let maxV = 0, minV = 0;
  const lines = regionTeams.map((t, i) => {
    const games = allGames
      .filter(g => g.homeAbbr === t.abbr || g.awayAbbr === t.abbr)
      .sort((a, b) => a.sortKey - b.sortKey);
    let cum = 0;
    const pts = [{ sortKey: globalMin, value: 0 }];
    games.forEach(g => {
      const isHome = g.homeAbbr === t.abbr;
      cum += valueFn(g, isHome);
      pts.push({ sortKey: g.sortKey, value: cum, date: g.date });
      maxV = Math.max(maxV, cum);
      minV = Math.min(minV, cum);
    });
    const lastReal = pts[pts.length - 1];
    if (lastReal.sortKey < globalMax) pts.push({ sortKey: globalMax, value: cum });
    return { team: t, pts, lastReal, isSelf: t.abbr === team.abbr };
  });
  if (maxV === minV) maxV = minV + 1;

  const yAt = v => padT + innerH - innerH * (v - minV) / (maxV - minV);

  const yTicks = minV < 0
    ? [minV, 0, maxV].filter((v, i, arr) => arr.indexOf(v) === i)
    : [0, Math.round(maxV / 2), maxV];
  const yTickHTML = yTicks.map(v => `
    <line x1="${padL}" y1="${yAt(v).toFixed(1)}" x2="${W - padR}" y2="${yAt(v).toFixed(1)}" stroke="${v === 0 ? '#30363d' : '#21262d'}" stroke-width="1"/>
    <text x="${padL - 6}" y="${(yAt(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#6e7681">${v}</text>
  `).join("");

  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const xTicks = [];
  const startMonth = new Date(globalMin);
  const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);
  while (cursor.getTime() <= globalMax) {
    xTicks.push(cursor.getTime());
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const xTickHTML = xTicks.map(t => {
    const x = xAt(t).toFixed(1);
    const label = `${MONTH_ABBR[new Date(t).getMonth()]} 1`;
    return `
      <line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="#21262d" stroke-width="1" stroke-dasharray="2,3"/>
      <text x="${x}" y="${H - padB + 11}" text-anchor="middle" font-size="9" fill="#6e7681">${label}</text>
    `;
  }).join("");

  // De-overlap end labels: sort by natural y, then enforce minimum vertical spacing
  const labelMinGap = 11;
  const labelTop = padT + 4, labelBottom = H - padB - 2;
  const colored = lines.map((line, i) => ({
    line, i,
    color: line.isSelf ? "#f0f6fc" : TF_PALETTE[i % TF_PALETTE.length],
    actualY: yAt(line.lastReal.value),
    labelY: yAt(line.lastReal.value),
  }));
  const order = [...colored].sort((a, b) => a.actualY - b.actualY);
  for (let i = 1; i < order.length; i++) {
    if (order[i].labelY - order[i - 1].labelY < labelMinGap) {
      order[i].labelY = order[i - 1].labelY + labelMinGap;
    }
  }
  const overflow = order[order.length - 1].labelY - labelBottom;
  if (overflow > 0) order.forEach(o => (o.labelY -= overflow));
  if (order[0].labelY < labelTop) {
    const diff = labelTop - order[0].labelY;
    order.forEach(o => (o.labelY += diff));
  }

  const labelX = xAt(globalMax) + 6;

  const drawn = colored.map(({ line, color, actualY, labelY }) => {
    const strokeWidth = line.isSelf ? 3 : 1.6;
    const d = line.pts.map((p, j) => `${j === 0 ? "M" : "L"} ${xAt(p.sortKey).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(" ");

    const needsLeader = Math.abs(labelY - actualY) > 2.5;
    const leader = needsLeader
      ? `<line x1="${xAt(globalMax).toFixed(1)}" y1="${actualY.toFixed(1)}" x2="${(labelX - 2).toFixed(1)}" y2="${labelY.toFixed(1)}" stroke="${color}" stroke-width="1" opacity="0.5"/>`
      : "";

    return {
      color,
      path: `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" opacity="${line.isSelf ? 1 : 0.85}"/>`,
      leader,
      label: `<text x="${labelX.toFixed(1)}" y="${(labelY + 3).toFixed(1)}" font-size="10" font-weight="700" fill="${color}">${line.team.abbr}</text>`,
    };
  });

  const chartId = chartRegistry.length;
  chartRegistry.push({
    W, H, padL, padR, padT, padB, globalMin, globalMax,
    lines: lines.map((line, i) => ({ abbr: line.team.abbr, color: drawn[i].color, isSelf: line.isSelf, pts: line.pts })),
  });

  return `
    <div class="tf-chart">
      <div class="tf-chart-header">${title} <span class="tf-gamelog-sub">${team.region}</span></div>
      <div class="tf-chart-wrap" data-chart-idx="${chartId}">
        <svg viewBox="0 0 ${W} ${H}" class="tf-chart-svg" preserveAspectRatio="none">
          ${yTickHTML}
          ${xTickHTML}
          ${drawn.map(d => d.path).join("")}
          ${drawn.map(d => d.leader).join("")}
          ${drawn.map(d => d.label).join("")}
          <line class="tf-chart-crosshair" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="#8b949e" stroke-width="1" stroke-dasharray="3,3" opacity="0"/>
        </svg>
        <div class="tf-chart-tooltip"></div>
      </div>
    </div>`;
}

function attachChartHoverHandlers(root) {
  root.querySelectorAll(".tf-chart-wrap").forEach(wrap => {
    const cfg = chartRegistry[+wrap.dataset.chartIdx];
    if (!cfg) return;
    const svg = wrap.querySelector("svg");
    const crosshair = wrap.querySelector(".tf-chart-crosshair");
    const tooltip = wrap.querySelector(".tf-chart-tooltip");
    const innerW = cfg.W - cfg.padL - cfg.padR;

    function valueAt(pts, key) {
      let v = 0, d = null;
      for (const p of pts) {
        if (p.sortKey <= key) { v = p.value; if (p.date) d = p.date; }
        else break;
      }
      return { v, d };
    }

    function onMove(e) {
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width * cfg.W;
      const frac = Math.max(0, Math.min(1, (relX - cfg.padL) / innerW));
      const hoverKey = cfg.globalMin + frac * (cfg.globalMax - cfg.globalMin);

      let dateLabel = "";
      const rows = cfg.lines.map(line => {
        const { v, d } = valueAt(line.pts, hoverKey);
        if (d) dateLabel = d;
        return { abbr: line.abbr, color: line.color, v, isSelf: line.isSelf };
      }).sort((a, b) => b.v - a.v);

      const xPix = cfg.padL + frac * innerW;
      crosshair.setAttribute("x1", xPix.toFixed(1));
      crosshair.setAttribute("x2", xPix.toFixed(1));
      crosshair.setAttribute("opacity", "1");

      tooltip.innerHTML = `
        <div class="tf-tt-date">${dateLabel}</div>
        ${rows.map(r => `
          <div class="tf-tt-row${r.isSelf ? " tf-tt-self" : ""}">
            <span class="tf-tt-dot" style="background:${r.color}"></span>${r.abbr}
            <span class="tf-tt-val">${r.v > 0 ? "+" : ""}${r.v}</span>
          </div>`).join("")}`;
      tooltip.style.opacity = "1";

      const wrapRect = wrap.getBoundingClientRect();
      let left = e.clientX - wrapRect.left + 14;
      let top = e.clientY - wrapRect.top - 10;
      if (left + 120 > wrapRect.width) left = e.clientX - wrapRect.left - 132;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function onLeave() {
      crosshair.setAttribute("opacity", "0");
      tooltip.style.opacity = "0";
    }

    svg.addEventListener("mousemove", onMove);
    svg.addEventListener("mouseleave", onLeave);
  });
}

function renderRegionalOpponentsTable(team) {
  if (team.division === "reserve") return "";
  const divData = ABL.divisions[team.division];
  const regionTeams = divData.regions[team.region].map(t => ({ ...t, division: team.division, region: team.region }));
  const sorted = [...regionTeams].sort((a, b) => tfPct(b) - tfPct(a));
  const leader = sorted[0];

  const rows = sorted.map((t, i) => {
    const classes = [];
    if (t.abbr === team.abbr) classes.push("tf-self-row");
    if (i === 0) classes.push("rank-1");
    else if (i === sorted.length - 1) classes.push("rank-bottom");

    const winPct = tfPct(t);
    const barColor = winPct >= 0.55 ? "#3fb950" : winPct >= 0.45 ? "#58a6ff" : "#f85149";
    const barWidth = (winPct * 100).toFixed(1);

    return `
      <tr class="${classes.join(" ")}">
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
    <div class="region-card tf-region-card">
      <div class="region-header">${team.region}</div>
      <table>
        <thead>
          <tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
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

function tfOrdinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function renderTeamNews(team) {
  if (team.division === "reserve") return "";
  const games = (window.ablGames || []).filter(g => g.homeAbbr === team.abbr || g.awayAbbr === team.abbr);
  if (!games.length) return "";

  const results = games.map(g => {
    const isHome = g.homeAbbr === team.abbr;
    const own = isHome ? g.homeScore : g.awayScore;
    const opp = isHome ? g.awayScore : g.homeScore;
    const oppAbbr = isHome ? g.awayAbbr : g.homeAbbr;
    return { date: g.date, own, opp, oppAbbr, won: own > opp, diff: own - opp };
  });

  const full = `${team.city} ${team.name}`;
  const possessive = `${full}${full.endsWith("s") ? "'" : "'s"}`;
  const articles = [];

  let streak = 1;
  const streakWon = results[results.length - 1].won;
  for (let i = results.length - 2; i >= 0 && results[i].won === streakWon; i--) streak++;
  if (streak >= 3) {
    articles.push({
      headline: streakWon ? `${team.abbr} Close Season on a Roll` : `${team.abbr} Stumble to the Finish`,
      body: streakWon
        ? `${full} won their final ${streak} games of the season, closing on a high note.`
        : `${full} dropped their final ${streak} games, a rough way to wrap up the schedule.`,
    });
  }

  const biggestWin = [...results].filter(r => r.won).sort((a, b) => b.diff - a.diff)[0];
  if (biggestWin) {
    articles.push({
      headline: `Season Highlight: ${biggestWin.own}-${biggestWin.opp} Rout`,
      body: `Their largest margin of victory came against ${biggestWin.oppAbbr} on ${biggestWin.date}, a ${biggestWin.own}-${biggestWin.opp} win.`,
    });
  }

  const worstLoss = [...results].filter(r => !r.won).sort((a, b) => a.diff - b.diff)[0];
  if (worstLoss) {
    articles.push({
      headline: `Rough Night vs ${worstLoss.oppAbbr}`,
      body: `${possessive} toughest loss came on ${worstLoss.date}, falling ${worstLoss.opp}-${worstLoss.own} to ${worstLoss.oppAbbr}.`,
    });
  }

  const half = Math.floor(results.length / 2);
  const sumDiff = arr => arr.reduce((s, r) => s + r.diff, 0);
  const firstHalf = sumDiff(results.slice(0, half));
  const secondHalf = sumDiff(results.slice(half));
  if (Math.abs(secondHalf - firstHalf) >= 8) {
    const improved = secondHalf > firstHalf;
    const fmt = v => (v >= 0 ? `+${v}` : `${v}`);
    articles.push({
      headline: improved ? `${team.abbr} Finished Strong` : `${team.abbr} Faded Down the Stretch`,
      body: improved
        ? `${full} were a different team in the second half, posting a ${fmt(secondHalf)} run differential after a ${fmt(firstHalf)} mark in the first.`
        : `${full} cooled off as the season wore on, posting a ${fmt(secondHalf)} run differential in the second half after starting at ${fmt(firstHalf)}.`,
    });
  }

  const divData = ABL.divisions[team.division];
  if (divData) {
    const regionTeams = divData.regions[team.region];
    const sorted = [...regionTeams].sort((a, b) => tfPct(b) - tfPct(a));
    const rank = sorted.findIndex(t => t.abbr === team.abbr) + 1;
    const leader = sorted[0];
    if (rank === 1) {
      articles.push({
        headline: `${team.abbr} Tops the ${team.region}`,
        body: `${full} finished atop the ${team.region}, the class of the region this season.`,
      });
    } else {
      articles.push({
        headline: `${team.abbr} Finishes ${rank}${tfOrdinal(rank)} in the ${team.region}`,
        body: `${full} ended the season ${gb(leader.w, leader.l, team.w, team.l)} games behind region-leading ${leader.abbr}.`,
      });
    }
  }

  if (!articles.length) return "";

  return `
    <div class="tf-news">
      <div class="tf-news-header">Season Wrap-Up <span class="tf-gamelog-sub">${team.region}</span></div>
      ${articles.slice(0, 4).map(a => `
        <div class="tf-news-article">
          <div class="tf-news-headline">${a.headline}</div>
          <div class="tf-news-body">${a.body}</div>
        </div>`).join("")}
    </div>`;
}

function renderTeamFocus() {
  if (!selectedTeamAbbr) {
    return `
      <div class="tf-wrap">
        ${renderTeamSelect()}
        <div class="tf-empty">Pick a team above to see its season at a glance.</div>
      </div>`;
  }

  const team = getAllTeamsForFocus().find(t => t.abbr === selectedTeamAbbr);
  const details = renderTeamDetails(selectedTeamAbbr);
  const opponentsTable = team ? renderRegionalOpponentsTable(team) : "";
  const news = team ? renderTeamNews(team) : "";

  return `
    <div class="tf-split">
      <div class="tf-split-left">
        ${renderTeamSelect()}
        ${renderTeamSummary(selectedTeamAbbr)}
        ${opponentsTable}
      </div>
      ${details ? `<div class="tf-split-right">${details}</div>` : ""}
      ${news ? `<div class="tf-split-news">${news}</div>` : ""}
    </div>`;
}

function render() {
  const app = document.getElementById("team-app");
  chartRegistry = [];
  app.innerHTML = renderTeamFocus();
  attachChartHoverHandlers(app);

  const picker = app.querySelector("#tf-team-picker");
  if (picker) {
    const input = picker.querySelector("#tf-team-search");
    const dropdown = picker.querySelector("#tf-team-dropdown");

    const openDropdown = () => {
      dropdown.hidden = false;
      filterDropdown("");
    };
    const closeDropdown = () => { dropdown.hidden = true; };

    function filterDropdown(query) {
      const q = query.trim().toLowerCase();
      dropdown.querySelectorAll(".tf-team-group").forEach(group => {
        let anyVisible = false;
        group.querySelectorAll(".tf-team-opt").forEach(opt => {
          const match = !q || opt.dataset.search.includes(q);
          opt.style.display = match ? "" : "none";
          if (match) anyVisible = true;
        });
        group.style.display = anyVisible ? "" : "none";
      });
    }

    input.addEventListener("focus", () => {
      input.select();
      openDropdown();
    });
    input.addEventListener("input", () => filterDropdown(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { input.blur(); closeDropdown(); }
    });

    dropdown.addEventListener("click", (e) => {
      const opt = e.target.closest(".tf-team-opt");
      if (!opt) return;
      selectedTeamAbbr = opt.dataset.abbr;
      render();
    });
  }
}

document.addEventListener("click", (e) => {
  const picker = document.getElementById("tf-team-picker");
  if (picker && !picker.contains(e.target)) {
    const dropdown = picker.querySelector("#tf-team-dropdown");
    if (dropdown) dropdown.hidden = true;
  }
});

render();
