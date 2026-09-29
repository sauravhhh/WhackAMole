/* Whack-a-Mole core logic — pure functions, virtual-time based, no DOM.
   Used by index.html and headless-tested in Node. */
(function (root) {
  'use strict';

  var DURATION = 60000;      // 60s game
  var CELLS = 9;             // 3x3 grid
  var POINTS = { mole: 1, gold: 3, bomb: -3 };

  function spawnInterval(elapsed) {
    // speeds up: 950ms -> 380ms over the game
    return Math.max(380, 950 - (elapsed / DURATION) * 570);
  }
  function moleTTL(elapsed) {
    // moles stay up shorter later: 1100ms -> 620ms
    return Math.max(620, 1100 - (elapsed / DURATION) * 480);
  }

  function createGame(rng) {
    return {
      rng: rng || Math.random,
      running: false,
      startAt: 0,
      score: 0,
      hits: 0, misses: 0, bombs: 0,
      moles: {},        // cell -> { type, born, ttl, whacked }
      nextSpawnAt: 0,
      ended: false
    };
  }

  function start(state, now) {
    state.running = true;
    state.ended = false;
    state.startAt = now;
    state.score = 0;
    state.hits = 0; state.misses = 0; state.bombs = 0;
    state.moles = {};
    state.nextSpawnAt = now + 400;
  }

  function pickType(rng) {
    var r = rng();
    if (r < 0.12) return 'gold';
    if (r < 0.27) return 'bomb';
    return 'mole';
  }

  function spawnOne(state, now) {
    var occupied = Object.keys(state.moles).map(Number);
    var free = [];
    for (var c = 0; c < CELLS; c++) if (occupied.indexOf(c) === -1) free.push(c);
    if (!free.length) return null;
    var cell = free[Math.floor(state.rng() * free.length)];
    var elapsed = now - state.startAt;
    state.moles[cell] = { type: pickType(state.rng), born: now, ttl: moleTTL(elapsed), whacked: false };
    return cell;
  }

  // Advance simulation to `now` (ms). Returns events: { spawned: [cells], expired: [cells], ended: bool }
  function tick(state, now) {
    var ev = { spawned: [], expired: [], ended: false };
    if (!state.running || state.ended) return ev;
    var elapsed = now - state.startAt;

    if (elapsed >= DURATION) {
      state.ended = true;
      state.running = false;
      state.moles = {};
      ev.ended = true;
      return ev;
    }

    // expire old moles
    Object.keys(state.moles).forEach(function (k) {
      var m = state.moles[k];
      if (!m.whacked && now - m.born >= m.ttl) {
        delete state.moles[k];
        ev.expired.push(+k);
      }
    });

    // spawn new ones (possibly several if lagging)
    var guard = 0;
    while (now >= state.nextSpawnAt && guard++ < 5) {
      var cell = spawnOne(state, now);
      if (cell !== null) ev.spawned.push(cell);
      state.nextSpawnAt = now + spawnInterval(elapsed) * (0.7 + state.rng() * 0.6);
    }
    return ev;
  }

  // Player whacks a cell at `now`. Returns { hit, type, points }.
  function whack(state, cell, now) {
    if (!state.running || state.ended) return { hit: false, type: null, points: 0 };
    var m = state.moles[cell];
    if (!m || m.whacked || now - m.born >= m.ttl) {
      state.misses++;
      return { hit: false, type: null, points: 0 };
    }
    m.whacked = true;
    delete state.moles[cell];
    var pts = POINTS[m.type];
    state.score = Math.max(0, state.score + pts);
    if (m.type === 'bomb') state.bombs++;
    else state.hits++;
    return { hit: true, type: m.type, points: pts };
  }

  function timeLeft(state, now) {
    if (!state.running && !state.ended) return DURATION;
    return Math.max(0, DURATION - (now - state.startAt));
  }

  var api = {
    DURATION: DURATION, CELLS: CELLS, POINTS: POINTS,
    createGame: createGame, start: start, tick: tick, whack: whack,
    timeLeft: timeLeft, spawnInterval: spawnInterval, moleTTL: moleTTL
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WhackLogic = api;
})(typeof window !== 'undefined' ? window : global);
