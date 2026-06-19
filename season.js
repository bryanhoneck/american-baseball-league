// Simulate a 54-game regular season for all 120 ABL teams via a real
// game-by-game schedule (see schedule.js). Records are DERIVED from that
// schedule, so the standings, the Team calendar, and any score display
// always agree. Stores {seed, records, games} in sessionStorage. The seed
// is shared with baseball-cup.js, championship.js, and promo.js so all
// simulations are derived from the same season — giving a consistent view
// across all pages.
(function () {
  const KEY = "abl_season_v3";

  // Mulberry32 seeded PRNG — exposed globally for other scripts to use
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  window.ablSeededRand = mulberry32;

  function applyRecords(records) {
    for (const div of Object.values(ABL.divisions)) {
      for (const teams of Object.values(div.regions)) {
        for (const team of teams) {
          const r = records[team.abbr];
          if (r) { team.w = r.w; team.l = r.l; }
        }
      }
    }
  }

  const stored = sessionStorage.getItem(KEY);
  if (stored) {
    const { seed, records, games } = JSON.parse(stored);
    window.ablSeed = seed;
    window.ablGames = games || [];
    applyRecords(records);
    return;
  }

  // Fresh season — generate seed then run all simulations through it
  const seed = Math.floor(Math.random() * 2147483647);
  window.ablSeed = seed;
  const rand = mulberry32(seed);

  const { games, records } = window.ablBuildSeasonSchedule(rand);
  window.ablGames = games;

  sessionStorage.setItem(KEY, JSON.stringify({ seed, records, games }));
  applyRecords(records);
})();
