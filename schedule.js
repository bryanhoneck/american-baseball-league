// schedule.js — builds a real 54-game schedule (Regional + Interleague) for
// the 4 main ABL divisions, with simulated scores. Team win/loss records are
// DERIVED from these games, so the schedule and the standings always agree.
(function () {
  const YEAR = 2026; // reference year, used only for weekday layout

  const TALENT = {
    major:        { min: 0.35, max: 0.65 },
    supplemental: { min: 0.32, max: 0.62 },
    minors1:      { min: 0.28, max: 0.58 },
    minors2:      { min: 0.25, max: 0.55 },
  };

  // Matches the date ranges used by the Home page season calendar.
  const REGIONAL_WEEKS = [
    { sm: 4, sd: 28, em: 5, ed: 4  },
    { sm: 5, sd: 6,  em: 5, ed: 11 },
    { sm: 5, sd: 12, em: 5, ed: 18 },
    { sm: 6, sd: 9,  em: 6, ed: 15 },
    { sm: 6, sd: 17, em: 6, ed: 22 },
    { sm: 7, sd: 20, em: 7, ed: 26 },
    { sm: 7, sd: 27, em: 8, ed: 3  },
    { sm: 8, sd: 4,  em: 8, ed: 10 },
    { sm: 9, sd: 1,  em: 9, ed: 7  },
    { sm: 9, sd: 15, em: 9, ed: 21 },
  ];

  const IL_WEEKS = [
    { sm: 4, sd: 15, em: 4, ed: 20 },
    { sm: 4, sd: 21, em: 4, ed: 27 },
    { sm: 5, sd: 20, em: 5, ed: 25 },
    { sm: 5, sd: 26, em: 6, ed: 1  },
    { sm: 6, sd: 2,  em: 6, ed: 8  },
    { sm: 6, sd: 23, em: 6, ed: 29 },
    { sm: 7, sd: 7,  em: 7, ed: 12 },
    { sm: 7, sd: 13, em: 7, ed: 19 },
    { sm: 8, sd: 11, em: 8, ed: 17 },
    { sm: 8, sd: 18, em: 8, ed: 24 },
    { sm: 8, sd: 25, em: 8, ed: 31 },
    { sm: 9, sd: 8,  em: 9, ed: 14 },
  ];

  function dObj(m, d) { return new Date(YEAR, m - 1, d); }
  function fmtDate(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function weekdayAbbr(d) { return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()]; }

  function daysInRange(sm, sd, em, ed, extendDays) {
    const days = [];
    let d = dObj(sm, sd);
    const end = dObj(em, ed);
    end.setDate(end.getDate() + (extendDays || 0));
    while (d <= end) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return days;
  }
  function findDow(days, dow) { return days.find(d => d.getDay() === dow) || null; }

  function regionalSeriesDays(week) {
    const days = daysInRange(week.sm, week.sd, week.em, week.ed);
    const patterns = [[4, 5, 6], [5, 6, 0]]; // Thu/Fri/Sat, Fri/Sat/Sun
    for (const pat of patterns) {
      const found = pat.map(dow => findDow(days, dow));
      if (found.every(Boolean)) return found;
    }
    return days.slice(0, 3);
  }

  function ilSeriesDays(week) {
    const days = daysInRange(week.sm, week.sd, week.em, week.ed, 3);
    const patterns = [[4, 6], [5, 0], [6, 1]]; // Thu&Sat, Fri&Sun, Sat&Mon
    for (const pat of patterns) {
      const found = pat.map(dow => findDow(days, dow));
      if (found.every(Boolean)) return found;
    }
    return days.slice(0, 2);
  }

  // Standard circle-method single round-robin: N teams (even) → N-1 rounds,
  // each round a perfect matching (every team plays exactly once per round).
  function circleRoundRobin(teams) {
    const n = teams.length;
    let order = [...teams];
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) pairs.push([order[i], order[n - 1 - i]]);
      rounds.push(pairs);
      order = [order[0], order[n - 1], ...order.slice(1, n - 1)];
    }
    return rounds;
  }

  // ── Win probability + score simulation ────────────────────────────────────
  function winProb(talentHome, talentAway, homeAdj) {
    return Math.max(0.2, Math.min(0.8, 0.5 + (talentHome - talentAway) + homeAdj));
  }

  function simRuns(rand, isWinner) {
    const base = isWinner ? 5 : 3;
    return Math.max(0, base + Math.floor(rand() * 5) - 1);
  }

  function playGame(rand, home, away, talents, dateObj, type) {
    const prob = winProb(talents[home.abbr], talents[away.abbr], 0.03);
    const homeWin = rand() < prob;
    let winnerRuns = simRuns(rand, true);
    let loserRuns  = simRuns(rand, false);
    if (loserRuns >= winnerRuns) loserRuns = Math.max(0, winnerRuns - 1 - Math.floor(rand() * 2));
    const homeScore = homeWin ? winnerRuns : loserRuns;
    const awayScore = homeWin ? loserRuns : winnerRuns;
    return {
      sortKey: dateObj.getTime(),
      date: fmtDate(dateObj),
      weekday: weekdayAbbr(dateObj),
      homeAbbr: home.abbr, awayAbbr: away.abbr,
      homeScore, awayScore, homeWin, type,
    };
  }

  // ── Regional double round-robin (6 teams → 10 rounds, circle method) ──────
  function buildRegionalGames(regionTeams, talents, rand) {
    const games = [];
    let order = [...regionTeams];
    const singleRounds = [];
    for (let r = 0; r < 5; r++) {
      singleRounds.push([[order[0], order[5]], [order[1], order[4]], [order[2], order[3]]]);
      order = [order[0], order[5], order[1], order[2], order[3], order[4]];
    }
    for (let leg = 0; leg < 2; leg++) {
      for (let r = 0; r < 5; r++) {
        const week = REGIONAL_WEEKS[leg * 5 + r];
        const seriesDays = regionalSeriesDays(week);
        for (const pair of singleRounds[r]) {
          const home = leg === 0 ? pair[0] : pair[1];
          const away = leg === 0 ? pair[1] : pair[0];
          for (const day of seriesDays) games.push(playGame(rand, home, away, talents, day, "Regional"));
        }
      }
    }
    return games;
  }

  // ── Interleague: round-robin across the whole division (30 teams → 29
  // rounds), keeping the 12 rounds with the fewest same-region pairings.
  // This always produces a perfect matching (every team plays exactly once
  // per round, no team ever idle) — unlike a greedy opponent-graph approach,
  // it can't fail partway through.
  function buildILGames(divTeams, talents, rand) {
    const rounds = circleRoundRobin(divTeams).map(pairs => ({
      pairs,
      conflicts: pairs.filter(([a, b]) => a.region === b.region).length,
    }));
    rounds.sort((a, b) => a.conflicts - b.conflicts);
    const chosen = rounds.slice(0, IL_WEEKS.length);

    const games = [];
    chosen.forEach((round, weekIdx) => {
      const seriesDays = ilSeriesDays(IL_WEEKS[weekIdx]);
      round.pairs.forEach(([a, b], pairIdx) => {
        const homeFirst = (weekIdx + pairIdx) % 2 === 0;
        const home = homeFirst ? a : b;
        const away = homeFirst ? b : a;
        for (const day of seriesDays) games.push(playGame(rand, home, away, talents, day, "IL"));
      });
    });
    return games;
  }

  function buildDivisionGames(divKey, divData, rand) {
    const { min, max } = TALENT[divKey];
    const talents = {};
    const divTeams = [];
    for (const [region, teams] of Object.entries(divData.regions)) {
      for (const t of teams) {
        talents[t.abbr] = min + rand() * (max - min);
        divTeams.push({ ...t, region });
      }
    }

    let games = [];
    for (const [region, teams] of Object.entries(divData.regions)) {
      games = games.concat(buildRegionalGames(teams.map(t => ({ ...t, region })), talents, rand));
    }
    games = games.concat(buildILGames(divTeams, talents, rand));
    return games;
  }

  function recordsFromGames(games) {
    const records = {};
    function bump(abbr, win) {
      if (!records[abbr]) records[abbr] = { w: 0, l: 0 };
      records[abbr][win ? "w" : "l"]++;
    }
    for (const g of games) {
      bump(g.homeAbbr, g.homeWin);
      bump(g.awayAbbr, !g.homeWin);
    }
    return records;
  }

  window.ablBuildSeasonSchedule = function (rand) {
    let allGames = [];
    for (const [divKey, divData] of Object.entries(ABL.divisions)) {
      allGames = allGames.concat(buildDivisionGames(divKey, divData, rand));
    }
    allGames.sort((a, b) => a.sortKey - b.sortKey);
    return { games: allGames, records: recordsFromGames(allGames) };
  };
})();
