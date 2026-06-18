// Simulate a 54-game regular season for all 120 ABL teams + 50 reserve teams.
// Stores {seed, records} in sessionStorage. The seed is shared with
// baseball-cup.js, championship.js, and promo.js so all simulations are
// derived from the same season — giving a consistent view across all pages.
(function () {
  const GAMES = 54;
  const KEY   = "abl_season_v3";

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

  const TALENT = {
    major:        { min: 0.35, max: 0.65 },
    supplemental: { min: 0.32, max: 0.62 },
    minors1:      { min: 0.28, max: 0.58 },
    minors2:      { min: 0.25, max: 0.55 },
    reserve:      { min: 0.20, max: 0.50 },
  };

  function applyRecords(records) {
    for (const div of Object.values(ABL.divisions)) {
      for (const teams of Object.values(div.regions)) {
        for (const team of teams) {
          const r = records[team.abbr];
          if (r) { team.w = r.w; team.l = r.l; }
        }
      }
    }
    for (const teams of Object.values(ABL_RESERVE.regions)) {
      for (const team of teams) {
        const r = records[team.abbr];
        if (r) { team.w = r.w; team.l = r.l; }
      }
    }
  }

  const stored = sessionStorage.getItem(KEY);
  if (stored) {
    const { seed, records } = JSON.parse(stored);
    window.ablSeed = seed;
    applyRecords(records);
    return;
  }

  // Fresh season — generate seed then run all simulations through it
  const seed = Math.floor(Math.random() * 2147483647);
  window.ablSeed = seed;
  const rand = mulberry32(seed);
  const records = {};

  for (const [divKey, div] of Object.entries(ABL.divisions)) {
    const { min, max } = TALENT[divKey];
    for (const teams of Object.values(div.regions)) {
      for (const team of teams) {
        const talent = min + rand() * (max - min);
        let w = 0;
        for (let g = 0; g < GAMES; g++) if (rand() < talent) w++;
        team.w = w;
        team.l = GAMES - w;
        records[team.abbr] = { w, l: GAMES - w };
      }
    }
  }

  const { min: rMin, max: rMax } = TALENT.reserve;
  for (const teams of Object.values(ABL_RESERVE.regions)) {
    for (const team of teams) {
      const talent = rMin + rand() * (rMax - rMin);
      let w = 0;
      for (let g = 0; g < GAMES; g++) if (rand() < talent) w++;
      team.w = w;
      team.l = GAMES - w;
      records[team.abbr] = { w, l: GAMES - w };
    }
  }

  sessionStorage.setItem(KEY, JSON.stringify({ seed, records }));
  applyRecords(records);
})();
