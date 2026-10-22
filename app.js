/*!
 * Chess.MAS v3.0 — app
 * (c) MAS Studio · MD Al Shahriar · MIT License
 */
(function () {
  'use strict';

  // ============================================================ helpers
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var KEY = 'chessmas3.';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del: function (k) { try { localStorage.removeItem(KEY + k); } catch (e) { /* ignore */ } }
  };
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icon(name) { return '<svg class="i"><use href="#i-' + name + '"/></svg>'; }
  var toastTimer = 0;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // ============================================================ config
  var LEVELS = [
    { id: 1, name: 'Pawn', elo: 400, piece: 'P', desc: 'Just learning how the pieces move. Leaves things hanging.', opts: { mode: 'scores', depth: 1, quiescence: false, noise: 220, random: 0.25 }, book: 2, delay: [500, 1100] },
    { id: 2, name: 'Knight', elo: 700, piece: 'N', desc: 'Grabs free material but misses most threats.', opts: { mode: 'scores', depth: 1, quiescence: true, noise: 120, random: 0.10 }, book: 4, delay: [500, 1200] },
    { id: 3, name: 'Bishop', elo: 1000, piece: 'B', desc: 'Spots simple tactics, still blunders under pressure.', opts: { mode: 'scores', depth: 2, quiescence: true, noise: 70, random: 0.04 }, book: 6, delay: [450, 1100] },
    { id: 4, name: 'Rook', elo: 1300, piece: 'R', desc: 'A solid club player who punishes loose pieces.', opts: { mode: 'scores', depth: 3, quiescence: true, noise: 30, random: 0.015, seeMates: true }, book: 8, delay: [400, 1000] },
    { id: 5, name: 'Queen', elo: 1600, piece: 'Q', desc: 'Calculates several moves deep and rarely hangs a piece.', opts: { mode: 'search', maxDepth: 4, timeMs: 450 }, book: 10, delay: [350, 900] },
    { id: 6, name: 'King', elo: 1900, piece: 'K', desc: 'A sharp tactician with a clear plan in every position.', opts: { mode: 'search', maxDepth: 8, timeMs: 1000 }, book: 14, delay: [300, 700] },
    { id: 7, name: 'MAS Max', elo: 2200, piece: 'logo', desc: 'The full-strength MAS Engine. It does not get tired.', opts: { mode: 'search', maxDepth: 64, timeMs: 2200 }, book: 16, delay: [200, 500] }
  ];
  var TCS = [
    { group: 'Bullet', items: [[1, 0], [2, 1]] },
    { group: 'Blitz', items: [[3, 0], [3, 2], [5, 0]] },
    { group: 'Rapid', items: [[10, 0], [15, 10]] },
    { group: 'Classical', items: [[30, 0]] },
    { group: 'Untimed', items: [[0, 0]] }
  ];
  var BOARDS = [
    { id: 'forest', name: 'Forest', l: '#ebecd0', d: '#739552' },
    { id: 'classic', name: 'Classic', l: '#f0d9b5', d: '#b58863' },
    { id: 'ocean', name: 'Ocean', l: '#e6ebef', d: '#5f86ad' },
    { id: 'midnight', name: 'Midnight', l: '#dcd6ee', d: '#7d6cae' }
  ];
  var SETS = ['classic', 'neo', 'minimal', 'pixel'];
  var THEMES = [
    { id: 'auto', name: 'Auto', bg: 'linear-gradient(90deg,#eef1f5 50%,#0f1216 50%)' },
    { id: 'light', name: 'Light', bg: 'linear-gradient(180deg,#ffffff 60%,#1d6fe8 60%)' },
    { id: 'dark', name: 'Dark', bg: 'linear-gradient(180deg,#171b21 60%,#3d8bff 60%)' },
    { id: 'retro', name: 'Retro', bg: 'linear-gradient(180deg,#c9d29a 60%,#c8322b 60%)' }
  ];
  var FIRST_MOVE_NAMES = { e2e4: "King's Pawn Opening", d2d4: "Queen's Pawn Opening", c2c4: 'English Opening', g1f3: 'Reti Opening', f2f4: "Bird's Opening", b2b3: 'Larsen Opening', g2g3: 'Hungarian Opening' };

  var settings = Object.assign({ theme: 'auto', board: 'forest', pieces: 'classic', sound: true, legal: true, premove: true, coords: true }, store.get('settings', {}));
  var profile = Object.assign({ rating: 1200, games: [], history: [1200], w: 0, d: 0, l: 0 }, store.get('profile', {}));
  var setup = Object.assign({ level: 3, color: 'r', tc: [10, 0], fTc: [10, 0], autoFlip: false, nameW: 'Player 1', nameB: 'Player 2' }, store.get('setup', {}));
  var LOGO_SRC = '';

  // ============================================================ theme
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    var root = document.documentElement;
    if (settings.theme === 'auto') root.removeAttribute('data-mode'); else root.setAttribute('data-mode', settings.theme);
    root.setAttribute('data-board', settings.board);
    root.setAttribute('data-pieces', settings.pieces);
  }

  // ============================================================ piece styles
  (function injectPieceCss() {
    var css = '';
    SETS.forEach(function (set) {
      var d = MAS_PIECES[set];
      ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].forEach(function (k) {
        css += '[data-pieces="' + set + '"] .pc[data-p="' + k + '"]{background-image:url("' + d[k] + '")}';
      });
    });
    SETS.forEach(function (set) {
      var d = MAS_PIECES[set];
      ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].forEach(function (k) {
        css += '.pc[data-set="' + set + '"][data-p="' + k + '"]{background-image:url("' + d[k] + '")}';
      });
    });
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  })();
  function pcHtml(code, set, cls) { return '<i class="pc' + (cls ? ' ' + cls : '') + '" data-p="' + code + '"' + (set ? ' data-set="' + set + '"' : '') + '></i>'; }

  // ============================================================ sound
  var Sound = {
    ctx: null,
    init: function () {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    knock: function (when, vol, freq) {
      var c = this.ctx, t = c.currentTime + (when || 0);
      var len = Math.floor(c.sampleRate * 0.06), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
      var src = c.createBufferSource(); src.buffer = buf;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 1400; bp.Q.value = 1.4;
      var g = c.createGain(); g.gain.value = vol;
      src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t);
      var o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
      og.gain.setValueAtTime(vol * 0.7, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(og); og.connect(c.destination); o.start(t); o.stop(t + 0.1);
    },
    tone: function (freq, when, dur, vol, type) {
      var c = this.ctx, t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    play: function (kind) {
      if (!settings.sound || !this.ctx) return;
      try {
        if (kind === 'move') this.knock(0, 0.55, 1300);
        else if (kind === 'capture') { this.knock(0, 0.8, 900); this.knock(0.035, 0.45, 1600); }
        else if (kind === 'castle') { this.knock(0, 0.5, 1300); this.knock(0.09, 0.5, 1150); }
        else if (kind === 'check') { this.knock(0, 0.55, 1300); this.tone(988, 0.02, 0.18, 0.12, 'triangle'); }
        else if (kind === 'start') { this.tone(523, 0, 0.14, 0.12); this.tone(784, 0.12, 0.22, 0.12); }
        else if (kind === 'end') { this.tone(784, 0, 0.16, 0.12); this.tone(659, 0.14, 0.16, 0.12); this.tone(523, 0.28, 0.3, 0.12); }
        else if (kind === 'low') this.tone(1320, 0, 0.06, 0.06, 'square');
        else if (kind === 'illegal') this.tone(180, 0, 0.12, 0.08, 'square');
      } catch (e) { /* audio unavailable */ }
    }
  };

  // ============================================================ engine client
  function EngineClient() {
    this.jobs = {}; this.seq = 0; this.worker = null; this.local = null;
    this.spawn();
  }
  EngineClient.prototype.spawn = function () {
    var self = this;
    try {
      var src = MASEngine.toString() + '\n' + MASEngineWorker.toString() + '\nMASEngineWorker();\n';
      var url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = function (e) { self.onMsg(e.data); };
      this.worker.onerror = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        self.worker = null; self.retryLocal();
      };
    } catch (e) { this.worker = null; }
  };
  EngineClient.prototype.onMsg = function (d) {
    var job = this.jobs[d.id];
    if (!job) return;
    if (d.type === 'progress') { if (job.onProgress) job.onProgress(d.done, d.total); return; }
    delete this.jobs[d.id]; clearTimeout(job.timer);
    if (d.type === 'error') job.reject(new Error(d.message)); else job.resolve(d.result);
  };
  EngineClient.prototype.retryLocal = function () {
    var self = this;
    Object.keys(this.jobs).forEach(function (id) { var j = self.jobs[id]; if (!j.local) { j.local = true; setTimeout(function () { self.runLocal(j.msg); }, 20); } });
  };
  EngineClient.prototype.run = function (msg, o) {
    var self = this; o = o || {};
    var id = ++this.seq; msg.id = id;
    return new Promise(function (resolve, reject) {
      var job = { resolve: resolve, reject: reject, onProgress: o.onProgress, msg: msg };
      self.jobs[id] = job;
      job.timer = setTimeout(function () {
        if (self.jobs[id]) { delete self.jobs[id]; self.restart(); reject(new Error('timeout')); }
      }, o.timeout || 10000);
      if (self.worker) { try { self.worker.postMessage(msg); return; } catch (e) { self.worker = null; } }
      job.local = true;
      setTimeout(function () { self.runLocal(msg); }, 30);
    });
  };
  EngineClient.prototype.runLocal = function (msg) {
    var self = this;
    if (!this.local) this.local = MASEngine();
    var E = this.local;
    var post = function (d) { self.onMsg(d); };
    try {
      if (msg.type === 'play') { E.setPosition(msg.fen, msg.moves); post({ id: msg.id, type: 'play', result: E.play(msg.opts) }); }
      else if (msg.type === 'think') { E.setPosition(msg.fen, msg.moves); post({ id: msg.id, type: 'think', result: E.think(msg.opts) }); }
      else if (msg.type === 'newgame') { E.clearTT(); post({ id: msg.id, type: 'newgame', result: true }); }
      else if (msg.type === 'analyze') {
        var out = [], i = 0;
        if (!msg.positions.length) { post({ id: msg.id, type: 'analyze', result: [] }); return; }
        var step = function () {
          if (!self.jobs[msg.id]) return;
          var pos = msg.positions[i];
          E.setPosition(pos.fen, pos.moves);
          var res = E.think({ timeMs: msg.opts.timeMs, maxDepth: msg.opts.maxDepth, analysis: true });
          var white = E.sideToMove() === 0;
          out.push({ move: res.move, score: white ? res.score : -res.score, depth: res.depth });
          i++;
          post({ id: msg.id, type: 'progress', done: i, total: msg.positions.length });
          if (i < msg.positions.length) setTimeout(step, 0); else post({ id: msg.id, type: 'analyze', result: out });
        };
        step();
      }
    } catch (e) { post({ id: msg.id, type: 'error', message: String(e && e.message || e) }); }
  };
  EngineClient.prototype.restart = function () {
    if (this.worker) { try { this.worker.terminate(); } catch (e) { /* ignore */ } }
    this.worker = null; this.spawn();
  };
  EngineClient.prototype.cancelAll = function () {
    var self = this, had = false;
    Object.keys(this.jobs).forEach(function (id) { had = true; clearTimeout(self.jobs[id].timer); self.jobs[id].reject(new Error('cancelled')); delete self.jobs[id]; });
    if (had) this.restart();
  };
  var Engine = new EngineClient();

  // ============================================================ opening book
  var Book = {
    root: { c: {}, names: [] },
    build: function () {
      var self = this;
      MAS_BOOK.forEach(function (line) {
        var parts = line.split('|'), name = parts[0], ch = new Chess(), node = self.root;
        parts[1].split(' ').forEach(function (san) {
          if (!node) return;
          var m = ch.move(san);
          if (!m) { node = null; return; }
          var u = m.from + m.to + (m.promotion || '');
          if (!node.c[u]) node.c[u] = { c: {}, n: 0, names: [] };
          node = node.c[u]; node.n++;
          if (node.names.indexOf(name) < 0) node.names.push(name);
        });
      });
    },
    node: function (ucis) { var n = this.root; for (var i = 0; i < ucis.length; i++) { n = n.c[ucis[i]]; if (!n) return null; } return n; },
    has: function (ucis) { return !!this.node(ucis); },
    pick: function (ucis) {
      var n = this.node(ucis); if (!n) return null;
      var ks = Object.keys(n.c); if (!ks.length) return null;
      var tot = 0; ks.forEach(function (k) { tot += n.c[k].n; });
      var r = Math.random() * tot;
      for (var i = 0; i < ks.length; i++) { r -= n.c[ks[i]].n; if (r <= 0) return ks[i]; }
      return ks[0];
    },
    name: function (ucis) {
      var n = this.root, best = null;
      for (var i = 0; i < ucis.length; i++) {
        n = n.c[ucis[i]]; if (!n) break;
        if (i === 0 && FIRST_MOVE_NAMES[ucis[0]]) best = FIRST_MOVE_NAMES[ucis[0]];
        if (n.names.length === 1) best = n.names[0];
        else {
          var fam = n.names[0].split(',')[0];
          if (n.names.every(function (x) { return x.split(',')[0] === fam; })) best = fam;
        }
      }
      return best;
    }
  };

  // ============================================================ board view
  function Board(root, h) {
    this.root = root; this.h = h; this.orient = 'w'; this.pieces = []; this.sqEls = {}; this.drag = null; this.marks = {};
    root.innerHTML = '<div class="squares"></div><div class="pieces"></div><svg class="arrows" viewBox="0 0 800 800"></svg>';
    this.sqLayer = root.children[0]; this.pcLayer = root.children[1]; this.arLayer = root.children[2];
    this.build(); this.bind();
  }
  Board.prototype.build = function () {
    var html = '';
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var sq = this.xyToSq(x, y), f = sq.charCodeAt(0) - 97, r = +sq[1] - 1;
      html += '<div class="sq' + ((f + r) % 2 === 0 ? ' d' : '') + '" data-sq="' + sq + '">';
      if (settings.coords) {
        if (x === 0) html += '<span class="coord rk">' + (r + 1) + '</span>';
        if (y === 7) html += '<span class="coord fl">' + sq[0] + '</span>';
      }
      html += '</div>';
    }
    this.sqLayer.innerHTML = html;
    var self = this; this.sqEls = {};
    $$('.sq', this.sqLayer).forEach(function (el) { self.sqEls[el.getAttribute('data-sq')] = el; });
    this.pieces.forEach(function (p) { self.place(p.el, p.sq); });
    this.applyMarks();
  };
  Board.prototype.setOrientation = function (o) { if (o !== this.orient) { this.orient = o; this.build(); this.drawArrows(this.arrows || []); } };
  Board.prototype.sqToXY = function (sq) { var f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; return this.orient === 'w' ? [f, 7 - r] : [7 - f, r]; };
  Board.prototype.xyToSq = function (x, y) { var f = this.orient === 'w' ? x : 7 - x, r = this.orient === 'w' ? 7 - y : y; return 'abcdefgh'[f] + (r + 1); };
  Board.prototype.pointToSq = function (cx, cy) {
    var rc = this.root.getBoundingClientRect();
    var x = Math.floor((cx - rc.left) / rc.width * 8), y = Math.floor((cy - rc.top) / rc.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return this.xyToSq(x, y);
  };
  Board.prototype.place = function (el, sq) { var xy = this.sqToXY(sq); el.style.transform = 'translate(' + (xy[0] * 100) + '%,' + (xy[1] * 100) + '%)'; };
  function sqDist(a, b) { return Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(+a[1] - +b[1]); }
  Board.prototype.setPosition = function (pos, animate) {
    var self = this, cur = this.pieces, used = {}, next = [], want = [];
    Object.keys(pos).forEach(function (sq) {
      var code = pos[sq], idx = -1;
      for (var i = 0; i < cur.length; i++) if (!used[i] && cur[i].sq === sq && cur[i].code === code) { idx = i; break; }
      if (idx >= 0) { used[idx] = true; self.place(cur[idx].el, sq); next.push(cur[idx]); } else want.push([sq, code]);
    });
    want.forEach(function (w) {
      var best = -1, bd = 99;
      for (var i = 0; i < cur.length; i++) {
        if (used[i] || cur[i].code !== w[1]) continue;
        var d = sqDist(cur[i].sq, w[0]); if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        used[best] = true; var p = cur[best]; p.sq = w[0];
        if (!animate) p.el.style.transition = 'none';
        self.place(p.el, w[0]);
        if (!animate) { void p.el.offsetWidth; p.el.style.transition = ''; }
        next.push(p);
      } else {
        var el = document.createElement('i'); el.className = 'pc'; el.setAttribute('data-p', w[1]);
        el.style.transition = 'none'; self.place(el, w[0]); self.pcLayer.appendChild(el);
        void el.offsetWidth; el.style.transition = '';
        next.push({ el: el, sq: w[0], code: w[1] });
      }
    });
    cur.forEach(function (p, i) {
      if (used[i]) return;
      if (animate) { p.el.classList.add('fade'); setTimeout(function () { p.el.remove(); }, 200); } else p.el.remove();
    });
    this.pieces = next;
  };
  Board.prototype.pieceAt = function (sq) { for (var i = 0; i < this.pieces.length; i++) if (this.pieces[i].sq === sq) return this.pieces[i]; return null; };
  Board.prototype.setMarks = function (m) { this.marks = m || {}; this.applyMarks(); };
  Board.prototype.applyMarks = function () {
    var m = this.marks, els = this.sqEls;
    Object.keys(els).forEach(function (sq) {
      var e = els[sq]; e.classList.remove('last', 'sel', 'check', 'pre', 'hover');
      var extra = e.querySelectorAll('.dot,.ring'); for (var i = 0; i < extra.length; i++) extra[i].remove();
    });
    if (m.last) m.last.forEach(function (s) { if (els[s]) els[s].classList.add('last'); });
    if (m.pre) m.pre.forEach(function (s) { if (els[s]) els[s].classList.add('pre'); });
    if (m.sel && els[m.sel]) els[m.sel].classList.add('sel');
    if (m.check && els[m.check]) els[m.check].classList.add('check');
    if (m.dots) m.dots.forEach(function (d) {
      if (!els[d.sq]) return;
      var s = document.createElement('span'); s.className = d.cap ? 'ring' : 'dot'; els[d.sq].appendChild(s);
    });
  };
  Board.prototype.drawArrows = function (list) {
    this.arrows = list || [];
    var self = this, svg = '';
    this.arrows.forEach(function (a) {
      var p1 = self.sqToXY(a.from), p2 = self.sqToXY(a.to);
      var x1 = p1[0] * 100 + 50, y1 = p1[1] * 100 + 50, x2 = p2[0] * 100 + 50, y2 = p2[1] * 100 + 50;
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
      var head = 36, w = 15, hw = 30;
      var ex = x2 - ux * head, ey = y2 - uy * head, sx = x1 + ux * 22, sy = y1 + uy * 22;
      var nx = -uy, ny = ux;
      svg += '<g opacity="0.82" fill="' + a.color + '">' +
        '<polygon points="' + [sx + nx * w / 2, sy + ny * w / 2, ex + nx * w / 2, ey + ny * w / 2, ex + nx * hw / 2, ey + ny * hw / 2, x2 - ux * 6, y2 - uy * 6, ex - nx * hw / 2, ey - ny * hw / 2, ex - nx * w / 2, ey - ny * w / 2, sx - nx * w / 2, sy - ny * w / 2].map(function (v) { return v.toFixed(1); }).join(' ') + '"/></g>';
    });
    this.arLayer.innerHTML = svg;
  };
  Board.prototype.bind = function () {
    var self = this, root = this.root;
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.addEventListener('pointerdown', function (e) {
      Sound.init();
      if (e.pointerType === 'mouse' && e.button !== 0) { if (e.button === 2 && self.h.onCancel) self.h.onCancel(); return; }
      if ($('.promo', root)) return;
      var sq = self.pointToSq(e.clientX, e.clientY); if (!sq) return;
      e.preventDefault();
      var res = self.h.onDown(sq);
      if (res && res.drag) {
        var p = self.pieceAt(sq); if (!p) return;
        self.drag = { p: p, sq: sq, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, hover: null };
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    });
    root.addEventListener('pointermove', function (e) {
      var d = self.drag; if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 5) return;
      d.moved = true;
      var rc = root.getBoundingClientRect(), s = rc.width / 8;
      d.p.el.classList.add('drag');
      d.p.el.style.transform = 'translate(' + (e.clientX - rc.left - s / 2) + 'px,' + (e.clientY - rc.top - s / 2) + 'px) scale(1.08)';
      var hv = self.pointToSq(e.clientX, e.clientY);
      if (hv !== d.hover) {
        if (d.hover && self.sqEls[d.hover]) self.sqEls[d.hover].classList.remove('hover');
        d.hover = hv; if (hv && self.sqEls[hv]) self.sqEls[hv].classList.add('hover');
      }
    });
    var end = function (e) {
      var d = self.drag; if (!d || e.pointerId !== d.id) return;
      self.drag = null;
      if (d.hover && self.sqEls[d.hover]) self.sqEls[d.hover].classList.remove('hover');
      d.p.el.classList.remove('drag');
      var target = e.type === 'pointercancel' ? null : self.pointToSq(e.clientX, e.clientY);
      if (d.moved && target && target !== d.sq) {
        if (!self.h.onDrop(d.sq, target)) self.place(d.p.el, d.sq);
      } else self.place(d.p.el, d.sq);
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  };
  Board.prototype.promote = function (color, toSq, cb) {
    var self = this, xy = this.sqToXY(toSq), fromTop = xy[1] === 0;
    var order = ['q', 'n', 'r', 'b'];
    var wrap = document.createElement('div'); wrap.className = 'promo';
    var col = document.createElement('div'); col.className = 'promo-col';
    col.style.left = (xy[0] * 12.5) + '%';
    if (fromTop) col.style.top = '0'; else col.style.bottom = '0';
    var items = order.map(function (t) { return '<button type="button" data-t="' + t + '" aria-label="Promote to ' + { q: 'queen', n: 'knight', r: 'rook', b: 'bishop' }[t] + '">' + pcHtml(color + t.toUpperCase()) + '</button>'; });
    var x = '<button type="button" class="x" data-t="">Cancel</button>';
    col.innerHTML = fromTop ? items.join('') + x : x + items.reverse().join('');
    wrap.appendChild(col); this.root.appendChild(wrap);
    var done = function (t) { wrap.remove(); cb(t || null); };
    wrap.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      var b = e.target.closest('button');
      done(b ? b.getAttribute('data-t') : null);
    });
  };

  // ============================================================ game state
  var G = null;
  var board = null;

  function newId() {
    var a = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', s = '';
    for (var i = 0; i < 6; i++) s += a[(Math.random() * a.length) | 0];
    return 'MAS-' + s;
  }
  function fenToPos(fen) {
    var pos = {}, rows = fen.split(' ')[0].split('/');
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i];
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        var color = ch === ch.toUpperCase() ? 'w' : 'b';
        pos['abcdefgh'[f] + (8 - r)] = color + ch.toUpperCase();
        f++;
      }
    }
    return pos;
  }
  function levelById(id) { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i]; return LEVELS[2]; }
  function tcLabel(tc) { return tc[0] ? tc[0] + '+' + tc[1] : 'Untimed'; }
  function other(c) { return c === 'w' ? 'b' : 'w'; }

  function createGame(cfg) {
    var chess = new Chess();
    var g = {
      cfg: cfg, chess: chess, mode: cfg.mode, level: cfg.mode === 'bot' ? levelById(cfg.level) : null,
      human: cfg.human || 'w', base: cfg.tc[0] * 60000, inc: cfg.tc[1] * 1000,
      clocks: { w: cfg.tc[0] * 60000, b: cfg.tc[0] * 60000 }, running: null, lastTick: 0,
      names: cfg.names, ucis: [], sans: [], fens: [START_FEN], moves: [], viewPly: 0,
      over: false, result: null, rated: cfg.mode === 'bot', id: cfg.id || newId(), startedAt: cfg.startedAt || Date.now(),
      selected: null, targets: [], premove: null, botToken: 0, botBusy: false, hint: null,
      opening: null, review: null, ratingBefore: profile.rating, ratingAfter: null, lowWarned: { w: false, b: false }
    };
    return g;
  }

  function startGame(cfg, savedMoves, savedClocks) {
    Engine.cancelAll();
    if (G) G.botToken++;
    G = createGame(cfg);
    Engine.run({ type: 'newgame' }).catch(function () { /* ignore */ });
    if (savedMoves && savedMoves.length) {
      savedMoves.forEach(function (u) {
        var m = G.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
        if (m) recordMove(m);
      });
      if (savedClocks) { G.clocks.w = savedClocks.w; G.clocks.b = savedClocks.b; }
      if (cfg.rated === false) G.rated = false;
    }
    G.viewPly = G.fens.length - 1;
    board.setOrientation(G.mode === 'bot' ? G.human : (cfg.autoFlip ? G.chess.turn() : 'w'));
    show('game');
    setReviewMode(false);
    board.setPosition(fenToPos(G.fens[G.viewPly]), false);
    board.drawArrows([]);
    updateRunning();
    renderAll();
    Sound.play('start');
    saveCurrent();
    if (G.mode === 'bot' && G.chess.turn() !== G.human && !G.over) scheduleBot();
  }

  function recordMove(m) {
    G.moves.push(m);
    G.ucis.push(m.from + m.to + (m.promotion || ''));
    G.sans.push(m.san);
    G.fens.push(G.chess.fen());
    var name = Book.name(G.ucis);
    if (name) G.opening = name;
  }

  // ---------- clock ----------
  function updateRunning() {
    var t = now();
    if (G.running && G.base > 0) { G.clocks[G.running] -= t - G.lastTick; }
    G.running = (!G.over && G.base > 0 && G.ucis.length >= 2) ? G.chess.turn() : null;
    G.lastTick = t;
  }
  function tick() {
    if (!G || G.over || !G.running || currentView !== 'game') { if (G) G.lastTick = now(); return; }
    var t = now(), side = G.running;
    G.clocks[side] -= t - G.lastTick; G.lastTick = t;
    if (G.clocks[side] <= 0) {
      G.clocks[side] = 0; renderClocks();
      var opp = other(side);
      finish(insufficientToMate(opp) ? null : opp, insufficientToMate(opp) ? 'timeout vs insufficient material' : 'on time');
      return;
    }
    if (G.clocks[side] < 10000 && !G.lowWarned[side] && G.base >= 60000) {
      G.lowWarned[side] = true;
      if (G.mode === 'friend' || side === G.human) Sound.play('low');
    }
    renderClocks();
  }
  function insufficientToMate(color) {
    var pos = fenToPos(G.chess.fen()), minors = 0, other = false;
    Object.keys(pos).forEach(function (s) {
      var p = pos[s]; if (p[0] !== color) return;
      if (p[1] === 'K') return;
      if (p[1] === 'N' || p[1] === 'B') minors++; else other = true;
    });
    return !other && minors <= 1;
  }
  function fmtClock(ms) {
    ms = Math.max(0, ms);
    if (ms < 20000) { var s = Math.floor(ms / 1000), t = Math.floor((ms % 1000) / 100); return '0:' + (s < 10 ? '0' : '') + s + '.' + t; }
    var total = Math.floor(ms / 1000), h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ---------- moves ----------
  function isHumanTurn() {
    if (!G || G.over) return false;
    return G.mode === 'friend' || G.chess.turn() === G.human;
  }
  function legalTargets(sq) {
    return G.chess.moves({ square: sq, verbose: true }).map(function (m) { return { sq: m.to, cap: !!m.captured }; });
  }
  function premoveTargets(sq) {
    var fen = G.chess.fen().split(' ');
    fen[1] = G.human; fen[3] = '-';
    var c = new Chess();
    if (!c.load(fen.join(' '))) return [];
    var piece = c.get(sq); if (!piece) return [];
    var list = c.moves({ square: sq, verbose: true }).map(function (m) { return m.to; });
    // pawns may also premove diagonally (a capture may become possible)
    if (piece.type === 'p') {
      var dir = G.human === 'w' ? 1 : -1, f = sq.charCodeAt(0), r = +sq[1] + dir;
      [-1, 1].forEach(function (df) { var ff = f + df; if (ff >= 97 && ff <= 104 && r >= 1 && r <= 8) list.push(String.fromCharCode(ff) + r); });
    }
    var seen = {}, out = [];
    list.forEach(function (t) { if (!seen[t]) { seen[t] = 1; out.push({ sq: t, cap: false }); } });
    return out;
  }
  function needsPromotion(from, to) {
    var p = G.chess.get(from);
    return p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
  }

  var handlers = {
    onDown: function (sq) {
      if (!G) return null;
      if (G.review) return null;
      if (G.viewPly !== G.fens.length - 1) { navTo(G.fens.length - 1); return null; }
      if (G.over) return null;
      var piece = G.chess.get(sq);
      if (isHumanTurn()) {
        if (G.selected && G.targets.some(function (t) { return t.sq === sq; })) { tryMove(G.selected, sq, true); return null; }
        if (piece && piece.color === G.chess.turn()) { select(sq); return { drag: true }; }
        deselect(); return null;
      }
      if (G.mode === 'bot' && settings.premove) {
        if (G.selected && G.targets.some(function (t) { return t.sq === sq; })) { setPremove(G.selected, sq); return null; }
        if (piece && piece.color === G.human) { G.premove = null; G.selected = sq; G.targets = premoveTargets(sq); renderMarks(); return { drag: true }; }
        G.premove = null; deselect(); return null;
      }
      return null;
    },
    onDrop: function (from, to) {
      if (!G || G.over || G.review) return false;
      if (isHumanTurn()) {
        if (!G.targets.some(function (t) { return t.sq === to; })) { deselect(); return false; }
        return tryMove(from, to, false);
      }
      if (G.mode === 'bot' && settings.premove && G.targets.some(function (t) { return t.sq === to; })) { setPremove(from, to); return false; }
      return false;
    },
    onCancel: function () { if (G) { G.premove = null; deselect(); } }
  };
  function select(sq) { G.selected = sq; G.targets = legalTargets(sq); renderMarks(); }
  function deselect() { if (!G) return; G.selected = null; G.targets = []; renderMarks(); }
  function setPremove(from, to) {
    G.premove = { from: from, to: to };
    G.selected = null; G.targets = [];
    renderMarks();
  }
  function tryMove(from, to, animate) {
    if (needsPromotion(from, to)) {
      var color = G.chess.turn();
      if (!animate) { var p = board.pieceAt(from); if (p) { p.el.style.transition = 'none'; board.place(p.el, to); } }
      board.promote(color, to, function (t) {
        if (!t) { board.setPosition(fenToPos(G.chess.fen()), false); deselect(); return; }
        doMove(from, to, t, true);
      });
      return true;
    }
    return doMove(from, to, null, animate);
  }
  function doMove(from, to, promo, animate) {
    var m = G.chess.move({ from: from, to: to, promotion: promo || 'q' });
    if (!m) { Sound.play('illegal'); deselect(); return false; }
    afterMove(m, animate);
    return true;
  }
  function afterMove(m, animate) {
    var mover = m.color;
    // clock bookkeeping for the side that just moved
    var t = now();
    if (G.running === mover && G.base > 0) {
      G.clocks[mover] -= t - G.lastTick;
      G.clocks[mover] += G.inc;
    }
    G.lastTick = t;
    recordMove(m);
    G.selected = null; G.targets = []; G.hint = null;
    G.viewPly = G.fens.length - 1;
    G.running = null; updateRunning();
    board.setPosition(fenToPos(G.chess.fen()), animate !== false);
    board.drawArrows([]);
    if (G.chess.in_check()) Sound.play('check');
    else if (m.flags.indexOf('k') >= 0 || m.flags.indexOf('q') >= 0) Sound.play('castle');
    else if (m.captured) Sound.play('capture');
    else Sound.play('move');
    checkEnd();
    renderAll();
    saveCurrent();
    if (G.over) return;
    if (G.mode === 'bot') {
      if (G.chess.turn() !== G.human) scheduleBot(); else runPremove();
    } else if (G.cfg.autoFlip) {
      setTimeout(function () { if (G && !G.over && G.mode === 'friend') { board.setOrientation(G.chess.turn()); renderPlayers(); renderMarks(); } }, 350);
    }
  }
  function runPremove() {
    var pm = G.premove; G.premove = null;
    if (!pm) { renderMarks(); return; }
    setTimeout(function () {
      if (!G || G.over || !isHumanTurn()) return;
      var legal = G.chess.moves({ square: pm.from, verbose: true }).some(function (m) { return m.to === pm.to; });
      if (!legal) { renderMarks(); return; }
      doMove(pm.from, pm.to, 'q', true);
    }, 60);
  }
  function checkEnd() {
    var c = G.chess;
    if (c.in_checkmate()) finish(other(c.turn()), 'by checkmate');
    else if (c.in_stalemate()) finish(null, 'by stalemate');
    else if (c.in_threefold_repetition()) finish(null, 'by repetition');
    else if (c.insufficient_material()) finish(null, 'by insufficient material');
    else if (c.in_draw()) finish(null, 'by the 50-move rule');
  }

  // ---------- bot ----------
  function fallbackMove() {
    var list = G.chess.moves({ verbose: true });
    if (!list.length) return null;
    var caps = list.filter(function (m) { return m.captured; });
    var pool = caps.length ? caps : list, m = pool[(Math.random() * pool.length) | 0];
    return m.from + m.to + (m.promotion || '');
  }
  function scheduleBot() {
    if (!G || G.over || G.mode !== 'bot' || G.chess.turn() === G.human) return;
    var token = ++G.botToken, botColor = G.chess.turn(), t0 = now(), lvl = G.level;
    G.botBusy = true; renderStatus();
    var finishMove = function (uci) {
      if (!G || token !== G.botToken || G.over) return;
      var legal = G.chess.moves({ verbose: true }).some(function (m) { return uci && m.from + m.to + (m.promotion || '') === uci || (uci && m.from + m.to === uci.slice(0, 4)); });
      if (!legal) uci = fallbackMove();
      if (!uci) return;
      var delay = lvl.delay[0] + Math.random() * (lvl.delay[1] - lvl.delay[0]);
      if (G.base > 0) delay = Math.min(delay, Math.max(60, G.clocks[botColor] / 45));
      var wait = Math.max(0, delay - (now() - t0));
      setTimeout(function () {
        if (!G || token !== G.botToken || G.over) return;
        G.botBusy = false;
        var m = G.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
        if (!m) { var f = fallbackMove(); m = f && G.chess.move({ from: f.slice(0, 2), to: f.slice(2, 4), promotion: f[4] || 'q' }); }
        if (m) afterMove(m, true);
      }, wait);
    };
    if (G.ucis.length < lvl.book && Math.random() < 0.94) {
      var b = Book.pick(G.ucis);
      if (b) { finishMove(b); return; }
    }
    var opts = Object.assign({}, lvl.opts);
    if (opts.mode === 'search' && G.base > 0) {
      var rem = G.clocks[botColor];
      opts.timeMs = Math.max(60, Math.min(opts.timeMs, rem / 28 + G.inc * 0.7));
    }
    Engine.run({ type: 'play', fen: START_FEN, moves: G.ucis.slice(), opts: opts }, { timeout: (opts.timeMs || 1500) + 6000 })
      .then(function (res) { finishMove(res && res.move); })
      .catch(function (err) { if (err && err.message === 'cancelled') return; finishMove(null); });
  }

  // ---------- finish ----------
  function finish(winner, reason) {
    if (G.over) return;
    updateRunning();
    G.over = true; G.running = null; G.botToken++; G.botBusy = false; G.premove = null;
    var aborted = G.ucis.length < 2 && reason === 'by resignation';
    G.result = { winner: winner, reason: reason, aborted: aborted };
    var change = 0;
    if (G.mode === 'bot' && !aborted) {
      var score = winner === G.human ? 1 : winner ? 0 : 0.5;
      if (G.rated) {
        var r = profile.rating, n = profile.games.length;
        var K = n < 10 ? 40 : r < 2000 ? 24 : 16;
        var E = 1 / (1 + Math.pow(10, (G.level.elo - r) / 400));
        var nr = Math.max(100, Math.round(r + K * (score - E)));
        change = nr - r; profile.rating = nr;
        profile.history.push(nr); if (profile.history.length > 60) profile.history.shift();
      }
      if (score === 1) profile.w++; else if (score === 0) profile.l++; else profile.d++;
      profile.games.unshift({ id: G.id, date: Date.now(), res: score === 1 ? 'w' : score === 0 ? 'l' : 'd', opp: G.level.name, oppElo: G.level.elo, change: G.rated ? change : null, color: G.human });
      if (profile.games.length > 50) profile.games.length = 50;
      store.set('profile', profile);
    }
    G.ratingAfter = profile.rating; G.ratingChange = change;
    store.del('current');
    Sound.play('end');
    renderAll(); renderHome();
    setTimeout(function () { if (G && G.over && currentView === 'game' && !G.review) openResult(); }, 650);
  }
  function resultText() {
    var r = G.result;
    if (r.aborted) return { title: 'Game aborted', kind: 'draw', why: 'No rating change' };
    if (!r.winner) return { title: 'Draw', kind: 'draw', why: r.reason };
    if (G.mode === 'bot') return r.winner === G.human ? { title: 'You won', kind: 'win', why: r.reason } : { title: G.level.name + ' won', kind: 'loss', why: r.reason };
    return { title: (r.winner === 'w' ? G.names.w : G.names.b) + ' won', kind: 'win', why: r.reason };
  }
  function scoreStr() { var r = G.result; if (!r || r.aborted) return '*'; return r.winner === 'w' ? '1-0' : r.winner === 'b' ? '0-1' : '1/2-1/2'; }

  // ============================================================ rendering (game)
  function captured(fen) {
    var start = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, cnt = { w: { P: 0, N: 0, B: 0, R: 0, Q: 0 }, b: { P: 0, N: 0, B: 0, R: 0, Q: 0 } };
    var pos = fenToPos(fen);
    Object.keys(pos).forEach(function (s) { var p = pos[s]; if (p[1] !== 'K') cnt[p[0]][p[1]]++; });
    var val = { P: 1, N: 3, B: 3, R: 5, Q: 9 }, mat = { w: 0, b: 0 }, caps = { w: [], b: [] };
    ['w', 'b'].forEach(function (c) {
      Object.keys(val).forEach(function (t) { mat[c] += cnt[c][t] * val[t]; });
      var o = other(c);
      ['P', 'N', 'B', 'R', 'Q'].forEach(function (t) { for (var i = 0; i < Math.max(0, start[t] - cnt[o][t]); i++) caps[c].push(o + t); });
    });
    return { caps: caps, diff: mat.w - mat.b };
  }
  function playerInfo(color) {
    if (G.mode === 'bot') {
      if (color === G.human) return { name: 'You', rating: profile.rating, av: pcHtml(color + 'K') };
      var l = G.level;
      return { name: l.name, rating: l.elo + (l.id === 7 ? '+' : ''), av: l.piece === 'logo' ? '<img src="' + LOGO_SRC + '" alt="">' : pcHtml(color + l.piece) };
    }
    return { name: color === 'w' ? G.names.w : G.names.b, rating: null, av: pcHtml(color + 'K') };
  }
  function renderPlayers() {
    var bottom = board.orient, top = other(bottom);
    var cap = captured(G.fens[G.viewPly]);
    [['#barTop', top], ['#barBottom', bottom]].forEach(function (pair) {
      var bar = $(pair[0]), c = pair[1], info = playerInfo(c);
      bar.setAttribute('data-color', c);
      $('.pl-av', bar).innerHTML = info.av;
      $('.pl-name', bar).innerHTML = esc(info.name) + (info.rating !== null ? '<small>(' + info.rating + ')</small>' : '');
      var list = cap.caps[c], html = '', prev = '';
      list.forEach(function (p) { html += pcHtml(p, null, prev && prev !== p ? 'gap' : ''); prev = p; });
      var adv = c === 'w' ? cap.diff : -cap.diff;
      if (adv > 0) html += '<em>+' + adv + '</em>';
      $('.pl-caps', bar).innerHTML = html;
    });
    renderClocks();
  }
  function renderClocks() {
    if (!G) return;
    [['#barTop', other(board.orient)], ['#barBottom', board.orient]].forEach(function (pair) {
      var el = $('.clock', $(pair[0])), c = pair[1];
      if (G.base <= 0) { el.classList.add('off'); return; }
      el.classList.remove('off');
      $('span', el).textContent = fmtClock(G.clocks[c]);
      var on = !G.over && G.chess.turn() === c && G.ucis.length >= 2;
      el.classList.toggle('on', on);
      el.classList.toggle('low', G.clocks[c] < 20000);
    });
  }
  function renderMarks() {
    if (!G) return;
    var m = {}, ply = G.viewPly;
    if (ply > 0) { var mv = G.moves[ply - 1]; m.last = [mv.from, mv.to]; }
    var live = ply === G.fens.length - 1;
    if (live && !G.review) {
      if (G.selected) { m.sel = G.selected; if (settings.legal) m.dots = G.targets; }
      if (G.premove) m.pre = [G.premove.from, G.premove.to];
    }
    var c = new Chess(G.fens[ply]);
    if (c.in_check()) {
      var pos = fenToPos(G.fens[ply]), k = c.turn() + 'K';
      Object.keys(pos).forEach(function (s) { if (pos[s] === k) m.check = s; });
    }
    board.setMarks(m);
  }
  function renderMoves() {
    var box = $('#moveList');
    if (!G.sans.length) { box.innerHTML = '<div class="moves-empty">' + (G.mode === 'bot' && G.human === 'b' ? 'The bot opens the game.' : 'Make your first move.') + '</div>'; return; }
    var html = '', rv = G.review && G.review.cls;
    for (var i = 0; i < G.sans.length; i += 2) {
      html += '<div class="mrow"><span class="n">' + (i / 2 + 1) + '.</span>';
      for (var j = i; j < i + 2; j++) {
        if (j >= G.sans.length) { html += '<span></span>'; continue; }
        var ci = rv && rv[j] ? clsIcon(rv[j]) : '';
        html += '<button type="button" class="mv' + (G.viewPly === j + 1 ? ' cur' : '') + '" data-ply="' + (j + 1) + '">' + ci + esc(G.sans[j]) + '</button>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
    var cur = $('.mv.cur', box);
    if (cur) {
      var top = cur.offsetTop - box.offsetTop, bottom = top + cur.offsetHeight;
      if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 2;
    } else if (G.viewPly === G.fens.length - 1) box.scrollTop = box.scrollHeight;
  }
  function renderStatus() {
    var el = $('#statusLine'), t = '';
    if (!G) return;
    if (G.review) {
      t = G.review.done ? 'Game review' : 'Reviewing the game…';
    } else if (G.over) {
      var r = resultText(); t = r.title + (r.why ? ' ' + r.why : '') + '.';
    } else if (G.viewPly !== G.fens.length - 1) {
      t = 'Viewing move ' + Math.ceil(G.viewPly / 2) + '. Tap a square to return to the game.';
    } else if (G.mode === 'bot') {
      if (G.chess.turn() === G.human) t = G.premove ? 'Your move' : (G.chess.in_check() ? 'Check! Your move' : 'Your move');
      else t = '<span class="think"><i></i><i></i><i></i></span>' + esc(G.level.name) + ' is thinking' + (G.premove ? ' · premove set' : '');
    } else {
      var n = G.chess.turn() === 'w' ? G.names.w : G.names.b;
      t = esc(n) + ' to move' + (G.chess.in_check() ? ' (check)' : '');
    }
    el.innerHTML = t;
  }
  function renderHead() {
    var ucis = G.ucis.slice(0, G.viewPly);
    var name = Book.name(ucis) || G.opening;
    $('#openingName').innerHTML = esc(name || 'Starting position') + '<small>' + esc((G.mode === 'bot' ? 'vs ' + G.level.name : 'Pass and play') + ' · ' + tcLabel(G.cfg.tc)) + '</small>';
    var b = $('#ratedBadge');
    b.textContent = G.mode === 'bot' ? (G.rated ? 'Rated' : 'Casual') : 'Friendly';
    b.classList.toggle('rated', G.mode === 'bot' && G.rated);
  }
  function renderActions() {
    var live = !G.over && !G.review;
    $('#gameActions').hidden = !!(G.over || G.review);
    $('#reviewActions').hidden = !(G.over || G.review);
    $('#actUndo').disabled = !live || G.ucis.length === 0;
    $('#actHint').disabled = !live || G.mode !== 'bot' || !isHumanTurn();
    $('#actHint').hidden = G.mode !== 'bot';
    $('#actDraw').disabled = !live || G.ucis.length < 2;
    $('#actResign').disabled = !live;
    $('#rvReview').hidden = !!G.review || G.ucis.length < 2;
  }
  function renderAll() {
    if (!G) return;
    renderPlayers(); renderMarks(); renderMoves(); renderStatus(); renderHead(); renderActions();
    if (G.review) renderReviewPly();
  }

  // ---------- navigation ----------
  function navTo(ply) {
    if (!G) return;
    ply = clamp(ply, 0, G.fens.length - 1);
    var delta = Math.abs(ply - G.viewPly);
    G.viewPly = ply;
    if (ply !== G.fens.length - 1) { G.selected = null; G.targets = []; }
    board.setPosition(fenToPos(G.fens[ply]), delta === 1);
    if (!G.review) board.drawArrows(G.hint && ply === G.fens.length - 1 ? [G.hint] : []);
    if (delta === 1 && ply > 0 && G.moves[ply - 1]) Sound.play(G.moves[ply - 1].captured ? 'capture' : 'move');
    renderAll();
  }

  // ---------- actions ----------
  function armConfirm(btn, label, fn) {
    if (btn.classList.contains('confirm')) { btn.classList.remove('confirm'); $('span', btn).textContent = btn.getAttribute('data-label'); clearTimeout(btn._t); fn(); return; }
    btn.setAttribute('data-label', $('span', btn).textContent);
    btn.classList.add('confirm'); $('span', btn).textContent = label;
    btn._t = setTimeout(function () { btn.classList.remove('confirm'); $('span', btn).textContent = btn.getAttribute('data-label'); }, 3000);
  }
  function takeback() {
    if (!G || G.over || !G.ucis.length) return;
    G.botToken++; G.botBusy = false; Engine.cancelAll(); G.premove = null; G.hint = null;
    var n = 1;
    if (G.mode === 'bot') {
      if (G.chess.turn() === G.human) n = G.ucis.length >= 2 ? 2 : 1;
      else n = 1;
      G.rated = false;
    }
    updateRunning();
    for (var i = 0; i < n; i++) {
      G.chess.undo(); G.ucis.pop(); G.sans.pop(); G.fens.pop(); G.moves.pop();
    }
    G.opening = Book.name(G.ucis) || null;
    G.viewPly = G.fens.length - 1; G.selected = null; G.targets = [];
    G.running = null; updateRunning();
    board.setPosition(fenToPos(G.chess.fen()), true); board.drawArrows([]);
    if (G.mode === 'friend' && G.cfg.autoFlip) board.setOrientation(G.chess.turn());
    renderAll(); saveCurrent();
    if (G.mode === 'bot') toast('Move taken back. This game is now unrated.');
    if (G.mode === 'bot' && G.chess.turn() !== G.human) scheduleBot();
  }
  function hint() {
    if (!G || G.over || G.mode !== 'bot' || !isHumanTurn()) return;
    var btn = $('#actHint'); btn.disabled = true;
    Engine.run({ type: 'think', fen: START_FEN, moves: G.ucis.slice(), opts: { timeMs: 900 } }, { timeout: 8000 }).then(function (r) {
      if (!G || G.over || !r || !r.move || !isHumanTurn()) return;
      if (G.rated) { G.rated = false; toast('Hint used. This game is now unrated.'); }
      G.hint = { from: r.move.slice(0, 2), to: r.move.slice(2, 4), color: '#15a34a' };
      board.drawArrows([G.hint]); renderAll(); saveCurrent();
    }).catch(function () { toast('The hint engine is busy. Try again in a moment.'); }).then(function () { renderActions(); });
  }
  function offerDraw() {
    if (!G || G.over) return;
    if (G.mode === 'friend') { armConfirm($('#actDraw'), 'Agree?', function () { finish(null, 'by agreement'); }); return; }
    if (G.ucis.length < 20) { toast(G.level.name + ' declines. It is too early for a draw.'); return; }
    Engine.run({ type: 'think', fen: START_FEN, moves: G.ucis.slice(), opts: { timeMs: 400 } }, { timeout: 6000 }).then(function (r) {
      if (!G || G.over) return;
      var botScore = G.chess.turn() !== G.human ? r.score : -r.score;
      if (botScore <= 40) finish(null, 'by agreement');
      else toast(G.level.name + ' declines the draw.');
    }).catch(function () { toast(G.level.name + ' declines the draw.'); });
  }
  function resign() {
    if (!G || G.over) return;
    armConfirm($('#actResign'), 'Confirm', function () {
      var loser = G.mode === 'bot' ? G.human : G.chess.turn();
      finish(other(loser), 'by resignation');
    });
  }

  // ---------- persistence ----------
  function saveCurrent() {
    if (!G || G.over) return;
    var t = now();
    var clocks = { w: G.clocks.w, b: G.clocks.b };
    if (G.running) clocks[G.running] -= t - G.lastTick;
    store.set('current', { cfg: G.cfg, ucis: G.ucis, clocks: clocks, rated: G.rated, saved: Date.now() });
  }
  window.addEventListener('pagehide', saveCurrent);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveCurrent(); });

  // ============================================================ review
  function winPct(cp) { cp = clamp(cp, -1500, 1500); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function normScore(s) { return Math.abs(s) > 20000 ? (s > 0 ? 10000 : -10000) : s; }
  var CLS = {
    book: { label: 'Book', g: '' }, best: { label: 'Best', g: '★' }, excellent: { label: 'Excellent', g: '!' }, good: { label: 'Good', g: '✓' },
    inaccuracy: { label: 'Inaccuracy', g: '?!' }, mistake: { label: 'Mistake', g: '?' }, blunder: { label: 'Blunder', g: '??' }
  };
  function clsIcon(k) {
    if (k === 'book') return '<span class="ci book" title="Book">' + '<svg viewBox="0 0 24 24"><use href="#i-book"/></svg></span>';
    return '<span class="ci ' + k + '" title="' + CLS[k].label + '">' + CLS[k].g + '</span>';
  }
  function setReviewMode(on) {
    $('#reviewBox').hidden = !on;
    $('.nav-row').hidden = false;
  }
  function startReview() {
    if (!G) return;
    closeModals();
    show('game');
    G.review = G.review || { done: false, evals: null, cls: [], acc: null };
    setReviewMode(true);
    G.viewPly = G.fens.length - 1;
    board.setPosition(fenToPos(G.fens[G.viewPly]), false);
    renderAll();
    if (G.review.done || G.review.running) return;
    G.review.running = true;
    var positions = G.fens.map(function (f, i) { return { fen: START_FEN, moves: G.ucis.slice(0, i) }; });
    var bar = $('#rvProgress i'); bar.style.width = '0%'; $('#rvProgress').hidden = false;
    var game = G;
    var per = positions.length > 120 ? 70 : positions.length > 70 ? 100 : 150;
    Engine.run({ type: 'analyze', positions: positions, opts: { timeMs: per, maxDepth: 16 } }, {
      timeout: positions.length * (per + 600) + 15000,
      onProgress: function (d, t) { if (game === G) bar.style.width = Math.round(d / t * 100) + '%'; }
    }).then(function (res) {
      if (game !== G) return;
      computeReview(res);
      G.review.running = false; G.review.done = true;
      $('#rvProgress').hidden = true;
      renderAll();
    }).catch(function (e) {
      if (game !== G) return;
      G.review.running = false;
      if (e && e.message === 'cancelled') return;
      toast('Review could not finish. Try again.');
    });
  }
  function computeReview(res) {
    var rv = G.review, n = G.ucis.length;
    var evals = res.map(function (r) { return normScore(r.score); });
    // terminal position: trust the actual result
    if (G.chess.in_checkmate()) evals[n] = G.chess.turn() === 'w' ? -10000 : 10000;
    else if (G.chess.game_over()) evals[n] = 0;
    rv.evals = evals; rv.best = res.map(function (r) { return r.move; });
    rv.cls = []; rv.bestSan = [];
    var accs = { w: [], b: [] }, counts = { w: {}, b: {} };
    for (var i = 0; i < n; i++) {
      var mover = G.fens[i].split(' ')[1], sg = mover === 'w' ? 1 : -1;
      var wb = winPct(sg * evals[i]), wa = winPct(sg * evals[i + 1]), drop = Math.max(0, wb - wa);
      var k;
      if (Book.has(G.ucis.slice(0, i + 1))) k = 'book';
      else if (G.ucis[i] === rv.best[i] || drop <= 0.6) k = 'best';
      else if (drop <= 2.5) k = 'excellent';
      else if (drop <= 5) k = 'good';
      else if (drop <= 10) k = 'inaccuracy';
      else if (drop <= 20) k = 'mistake';
      else k = 'blunder';
      rv.cls[i] = k;
      counts[mover][k] = (counts[mover][k] || 0) + 1;
      if (k !== 'book') accs[mover].push(clamp(103.1668 * Math.exp(-0.04354 * drop) - 3.1669, 0, 100));
      var bs = '';
      if (rv.best[i] && rv.best[i] !== G.ucis[i]) {
        var c = new Chess(G.fens[i]); var bm = c.move({ from: rv.best[i].slice(0, 2), to: rv.best[i].slice(2, 4), promotion: rv.best[i][4] || 'q' });
        bs = bm ? bm.san : '';
      }
      rv.bestSan[i] = bs;
    }
    var acc = function (list) {
      if (!list.length) return 100;
      var mean = list.reduce(function (a, b) { return a + b; }, 0) / list.length;
      var harm = list.length / list.reduce(function (a, b) { return a + 1 / Math.max(b, 5); }, 0);
      return (mean + harm) / 2;
    };
    rv.acc = { w: acc(accs.w), b: acc(accs.b) };
    rv.counts = counts;
  }
  function fmtEval(cp) {
    if (Math.abs(cp) >= 10000) return (cp > 0 ? '+' : '-') + 'M';
    var v = cp / 100; return (v > 0 ? '+' : '') + v.toFixed(1);
  }
  function renderReviewPly() {
    var rv = G.review; if (!rv) return;
    var accBox = $('#accBox'), names = { w: playerInfo('w').name, b: playerInfo('b').name };
    if (!rv.done) {
      accBox.innerHTML = '<div><span>' + esc(names.w) + '</span><b>…</b></div><div><span>' + esc(names.b) + '</span><b>…</b></div>';
      $('#clsTable').innerHTML = ''; $('#moveComment').textContent = 'The engine is checking every move.'; $('#evalGraph').innerHTML = '';
      return;
    }
    accBox.innerHTML = '<div><span>' + esc(names.w) + ' · accuracy</span><b>' + rv.acc.w.toFixed(1) + '</b></div><div><span>' + esc(names.b) + ' · accuracy</span><b>' + rv.acc.b.toFixed(1) + '</b></div>';
    var ply = G.viewPly, ev = rv.evals[ply];
    $('#evalFill').style.width = winPct(ev).toFixed(1) + '%';
    $('#evalText').textContent = fmtEval(ev);
    // comment
    var cm = $('#moveComment');
    if (ply === 0) cm.innerHTML = 'Start of the game. Step through the moves with the arrows.';
    else {
      var k = rv.cls[ply - 1], san = G.sans[ply - 1], best = rv.bestSan[ply - 1];
      var phrase = { book: 'is a book move', best: 'is the best move', excellent: 'is excellent', good: 'is good', inaccuracy: 'is an inaccuracy', mistake: 'is a mistake', blunder: 'is a blunder' }[k];
      cm.innerHTML = clsIcon(k) + '<span><b>' + esc(san) + '</b> ' + phrase + '.' + ((k === 'inaccuracy' || k === 'mistake' || k === 'blunder') && best ? ' Best was <b>' + esc(best) + '</b>.' : '') + '</span>';
    }
    // best-move arrow for the move that led here
    var arrows = [];
    if (ply > 0) {
      var kk = rv.cls[ply - 1];
      if ((kk === 'inaccuracy' || kk === 'mistake' || kk === 'blunder') && rv.best[ply - 1]) {
        var bu = rv.best[ply - 1]; arrows.push({ from: bu.slice(0, 2), to: bu.slice(2, 4), color: '#15a34a' });
      }
    }
    board.drawArrows(arrows);
    // classification table
    var order = ['best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];
    var t = '<span class="h"></span><span class="h">W</span><span class="h">B</span>';
    order.forEach(function (k) {
      t += '<span class="lbl">' + clsIcon(k) + CLS[k].label + '</span><span class="c">' + (rv.counts.w[k] || 0) + '</span><span class="c">' + (rv.counts.b[k] || 0) + '</span>';
    });
    $('#clsTable').innerHTML = t;
    // graph
    var n = rv.evals.length, W = 300, H = 70, pts = [];
    for (var i = 0; i < n; i++) pts.push([(n === 1 ? 0 : i / (n - 1) * W), H - winPct(rv.evals[i]) / 100 * H]);
    var d = 'M0 ' + H + ' ' + pts.map(function (p) { return 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + ' L' + W + ' ' + H + ' Z';
    var cx = (n === 1 ? 0 : ply / (n - 1) * W).toFixed(1);
    $('#evalGraph').innerHTML = '<path class="wfill" d="' + d + '"/><line class="mid" x1="0" y1="35" x2="300" y2="35"/><line class="cur" x1="' + cx + '" y1="0" x2="' + cx + '" y2="70"/>';
  }

  // ============================================================ PDF export
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function dataUrlBytes(url) {
    var b64 = url.split(',')[1], bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function boardJpeg(fen, size) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    var ctx = cv.getContext('2d'), sq = size / 8, theme = BOARDS.filter(function (b) { return b.id === settings.board; })[0] || BOARDS[0];
    var orient = G.mode === 'bot' ? G.human : 'w';
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
      var f = orient === 'w' ? x : 7 - x, r = orient === 'w' ? 7 - y : y;
      ctx.fillStyle = (f + r) % 2 === 0 ? theme.d : theme.l; ctx.fillRect(x * sq, y * sq, sq, sq);
    }
    ctx.font = 'bold ' + Math.round(sq * 0.17) + 'px Helvetica, Arial, sans-serif';
    var bottomRank = orient === 'w' ? 0 : 7, leftFile = orient === 'w' ? 0 : 7;
    for (var i = 0; i < 8; i++) {
      var file = orient === 'w' ? i : 7 - i, rank = orient === 'w' ? 7 - i : i;
      ctx.fillStyle = (file + bottomRank) % 2 === 0 ? theme.l : theme.d;
      ctx.fillText('abcdefgh'[file], i * sq + sq * 0.8, size - sq * 0.08);
      ctx.fillStyle = (leftFile + rank) % 2 === 0 ? theme.l : theme.d;
      ctx.fillText(String(rank + 1), sq * 0.06, i * sq + sq * 0.2);
    }
    var pos = fenToPos(fen), keys = Object.keys(pos);
    var set = MAS_PIECES[settings.pieces];
    return Promise.all(keys.map(function (s) { return loadImg(set[pos[s]]); })).then(function (imgs) {
      keys.forEach(function (s, idx) {
        var fx = s.charCodeAt(0) - 97, ry = +s[1] - 1;
        var px = orient === 'w' ? fx : 7 - fx, py = orient === 'w' ? 7 - ry : ry;
        ctx.drawImage(imgs[idx], px * sq, py * sq, sq, sq);
      });
      return dataUrlBytes(cv.toDataURL('image/jpeg', 0.92));
    });
  }
  function logoJpeg(size) {
    return loadImg(LOGO_SRC).then(function (im) {
      var cv = document.createElement('canvas'); cv.width = cv.height = size;
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size); ctx.drawImage(im, 0, 0, size, size);
      return dataUrlBytes(cv.toDataURL('image/jpeg', 0.92));
    }).catch(function () { return null; });
  }
  function pdfStr(s) {
    s = String(s).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...');
    var out = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); out += (c >= 32 && c < 127) || (c >= 160 && c <= 255) ? s[i] : '?'; }
    return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }
  function makePdf(pages, images) {
    var chunks = [], len = 0, offs = [];
    var push = function (x) {
      var b;
      if (typeof x === 'string') { b = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) b[i] = x.charCodeAt(i) & 255; }
      else b = x;
      chunks.push(b); len += b.length;
    };
    var nPages = pages.length, firstImg = 5, firstPage = firstImg + images.length;
    var total = firstPage + nPages * 2 - 1;
    var begin = function (n) { offs[n] = len; push(n + ' 0 obj\n'); };
    push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    begin(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    var kids = []; for (var p = 0; p < nPages; p++) kids.push((firstPage + p * 2) + ' 0 R');
    begin(2); push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + nPages + ' >>\nendobj\n');
    begin(3); push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
    begin(4); push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
    var xo = [];
    images.forEach(function (im, i) {
      var n = firstImg + i; xo.push('/' + im.name + ' ' + n + ' 0 R');
      begin(n); push('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n');
      push(im.bytes); push('\nendstream\nendobj\n');
    });
    pages.forEach(function (content, i) {
      var pn = firstPage + i * 2, cn = pn + 1;
      begin(pn); push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ' + xo.join(' ') + ' >> >> /Contents ' + cn + ' 0 R >>\nendobj\n');
      begin(cn); push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
    });
    var xref = len;
    var x = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= total; k++) x += String(offs[k]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var out = new Uint8Array(len), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }
  function buildPdf() {
    var g = G, finalFen = g.fens[g.fens.length - 1];
    return Promise.all([boardJpeg(finalFen, 640), logoJpeg(160)]).then(function (imgs) {
      var images = [{ name: 'Im1', w: 640, h: 640, bytes: imgs[0] }];
      if (imgs[1]) images.push({ name: 'Im2', w: 160, h: 160, bytes: imgs[1] });
      var txt = function (font, size, x, y, s, rgb) { return (rgb || '0.07 0.09 0.13') + ' rg BT /' + font + ' ' + size + ' Tf ' + x + ' ' + y + ' Td (' + pdfStr(s) + ') Tj ET\n'; };
      var rt = resultText(), wInfo = playerInfo('w'), bInfo = playerInfo('b');
      var p1 = '';
      p1 += '0.07 0.09 0.11 rg 0 742 595 100 re f\n';
      if (imgs[1]) p1 += 'q 64 0 0 64 40 760 cm /Im2 Do Q\n';
      p1 += txt('F2', 26, imgs[1] ? 118 : 40, 798, 'Chess.MAS', '1 1 1');
      p1 += txt('F1', 11, imgs[1] ? 118 : 40, 778, 'Game record  |  MAS Studio', '0.62 0.68 0.76');
      p1 += txt('F2', 11, 420, 798, g.id, '0.24 0.55 1');
      p1 += txt('F1', 9, 420, 782, new Date(g.startedAt).toLocaleString(), '0.62 0.68 0.76');
      p1 += txt('F2', 20, 40, 700, scoreStr().replace('1/2-1/2', '1/2 - 1/2') + '   ' + rt.title + (rt.why ? ' ' + rt.why : ''));
      var rows = [
        ['White', wInfo.name + (wInfo.rating !== null ? ' (' + wInfo.rating + ')' : '')],
        ['Black', bInfo.name + (bInfo.rating !== null ? ' (' + bInfo.rating + ')' : '')],
        ['Result', scoreStr() + '  ' + (rt.why || '')],
        ['Time control', g.base ? tcLabel(g.cfg.tc) + ' (minutes + seconds per move)' : 'Untimed'],
        ['Opening', g.opening || 'Unnamed'],
        ['Moves', String(Math.ceil(g.ucis.length / 2))],
        ['Mode', g.mode === 'bot' ? (g.rated ? 'Rated game vs ' + g.level.name : 'Casual game vs ' + g.level.name) : 'Pass and play']
      ];
      if (g.mode === 'bot' && g.rated && !g.result.aborted) rows.push(['Your rating', g.ratingBefore + ' -> ' + g.ratingAfter + ' (' + (g.ratingChange >= 0 ? '+' : '') + g.ratingChange + ')']);
      if (g.review && g.review.done) rows.push(['Accuracy', 'White ' + g.review.acc.w.toFixed(1) + '  |  Black ' + g.review.acc.b.toFixed(1)]);
      var y = 668;
      rows.forEach(function (r) {
        p1 += txt('F1', 9, 40, y, r[0].toUpperCase(), '0.45 0.5 0.58');
        p1 += txt('F2', 11, 40, y - 13, r[1]);
        y -= 28;
      });
      p1 += 'q 230 0 0 230 325 438 cm /Im1 Do Q\n';
      p1 += '0.8 0.83 0.88 RG 0.8 w 325 438 230 230 re S\n';
      p1 += txt('F1', 9, 325, 425, 'Final position', '0.45 0.5 0.58');
      // moves
      var ann = { inaccuracy: '?!', mistake: '?', blunder: '??' };
      var rowsM = [];
      for (var i = 0; i < g.sans.length; i += 2) {
        var a = function (j) { var s = g.sans[j]; if (s && g.review && g.review.done && ann[g.review.cls[j]]) s += ann[g.review.cls[j]]; return s || ''; };
        rowsM.push([(i / 2 + 1) + '.', a(i), a(i + 1)]);
      }
      if (!rowsM.length) rowsM.push(['', 'No moves were played.', '']);
      rowsM.push(['', scoreStr(), '']);
      var pages = [], content = p1, yTop = 380, col = 0, yy;
      content += '0.85 0.87 0.9 RG 0.8 w 40 400 m 555 400 l S\n';
      content += txt('F2', 13, 40, 386, 'Moves');
      yy = yTop - 16; var colW = 172, lineH = 14.5, minY = 56;
      rowsM.forEach(function (rw, idx) {
        if (yy < minY) {
          col++;
          if (col > 2) { pages.push(content); content = ''; col = 0; yTop = 790; yy = yTop; }
          else yy = yTop - (pages.length ? 0 : 16);
        }
        var x = 40 + col * colW, last = idx === rowsM.length - 1;
        if (rw[0]) content += txt('F1', 10.5, x, yy, rw[0], '0.45 0.5 0.58');
        content += txt(last ? 'F2' : 'F1', 10.5, x + 26, yy, rw[1]);
        if (rw[2]) content += txt('F1', 10.5, x + 92, yy, rw[2]);
        yy -= lineH;
      });
      pages.push(content);
      pages = pages.map(function (pg, idx) {
        return pg + txt('F1', 8.5, 40, 28, 'Generated by Chess.MAS v3.0  |  free and open source by MAS Studio  |  github.com/Al-Shahriar-12', '0.5 0.55 0.62') +
          txt('F1', 8.5, 520, 28, 'Page ' + (idx + 1) + ' / ' + pages.length, '0.5 0.55 0.62');
      });
      return makePdf(pages, images);
    });
  }
  var downloadsCap = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try { window.claude.use('downloads').then(function (d) { downloadsCap = d; }).catch(function () { downloadsCap = null; }); } catch (e) { /* ignore */ }
  }
  function saveFile(bytes, filename, mime) {
    if (downloadsCap) {
      return downloadsCap.save({ filename: filename, data: new Blob([bytes], { type: mime }) })
        .then(function () { toast('Saved ' + filename); })
        .catch(function (e) { if (!e || e.code !== 'declined') toast('Saving is not available here. Install the app to save PDFs.'); });
    }
    if (window.claude && window.parent !== window) { toast('Saving files is not available in this preview. Open Chess.MAS in your browser or the installed app.'); return Promise.resolve(); }
    var url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    var a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    toast('Saved ' + filename);
    return Promise.resolve();
  }
  function savePdf() {
    if (!G) return;
    toast('Preparing your PDF…');
    buildPdf().then(function (bytes) { return saveFile(bytes, 'Chess.MAS-' + G.id.replace('MAS-', '') + '.pdf', 'application/pdf'); })
      .catch(function (e) { toast('The PDF could not be created.'); if (window.console) console.error(e); });
  }
  function pgnText() {
    var d = new Date(G.startedAt), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var w = playerInfo('w'), b = playerInfo('b');
    var h = '[Event "Chess.MAS"]\n[Site "Chess.MAS"]\n[Date "' + d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '"]\n' +
      '[White "' + w.name + '"]\n[Black "' + b.name + '"]\n[Result "' + scoreStr() + '"]\n[GameId "' + G.id + '"]\n' +
      '[TimeControl "' + (G.base ? G.base / 1000 + '+' + G.inc / 1000 : '-') + '"]\n' + (G.opening ? '[Opening "' + G.opening + '"]\n' : '') + '\n';
    var body = '';
    for (var i = 0; i < G.sans.length; i += 2) body += (i / 2 + 1) + '. ' + G.sans[i] + (G.sans[i + 1] ? ' ' + G.sans[i + 1] : '') + ' ';
    return h + body + scoreStr() + '\n';
  }
  function copyPgn() {
    var text = pgnText();
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('PGN copied'); } catch (e) { toast('Copy failed. Select the text manually.'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('PGN copied'); }, fallback);
    else fallback();
  }

  // ============================================================ views
  var currentView = 'home', prevView = 'home';
  function show(v) {
    if (v !== currentView) prevView = currentView;
    currentView = v;
    ['home', 'setup', 'game', 'about'].forEach(function (n) { $('#view-' + n).hidden = n !== v; });
    if (v === 'home') renderHome();
    window.scrollTo(0, 0);
    if (G) G.lastTick = now();
  }
  function goHome() {
    if (G && !G.over && !G.review) { saveCurrent(); G.botToken++; Engine.cancelAll(); }
    show('home');
  }

  function renderHome() {
    $('#homeRating').textContent = profile.rating;
    $('#topRating').textContent = profile.rating;
    $('#homeWdl').innerHTML = '<span><b>' + profile.w + '</b> W</span><span><b>' + profile.d + '</b> D</span><span><b>' + profile.l + '</b> L</span>';
    var h = profile.history.slice(-30), sp = $('#spark');
    if (h.length < 2) h = [h[0] || profile.rating, h[0] || profile.rating];
    var mn = Math.min.apply(null, h) - 15, mx = Math.max.apply(null, h) + 15, W = 300, H = 64;
    var pts = h.map(function (v, i) { return [i / (h.length - 1) * W, H - 6 - (v - mn) / (mx - mn) * (H - 12)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    sp.innerHTML = '<path class="area" d="' + line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z"/><path class="ln" d="' + line + '"/><circle class="dot" cx="' + (last[0] - 4) + '" cy="' + last[1] + '" r="4"/>';
    var rl = $('#recentList');
    if (!profile.games.length) rl.innerHTML = '<p class="empty-note">Finish a game against the bot to start your rating history.</p>';
    else rl.innerHTML = profile.games.slice(0, 5).map(function (g) {
      var ch = g.change === null || g.change === undefined ? '<span class="chg">-</span>' : '<span class="chg ' + (g.change >= 0 ? 'pos' : 'neg') + '">' + (g.change >= 0 ? '+' : '') + g.change + '</span>';
      return '<div class="recent-row"><span class="res ' + g.res + '">' + g.res.toUpperCase() + '</span><span class="opp">vs ' + esc(g.opp) + ' <small style="color:var(--muted)">(' + g.oppElo + ')</small></span><span style="color:var(--muted);font-size:12px">' + new Date(g.date).toLocaleDateString() + '</span>' + ch + '</div>';
    }).join('');
    $('#homeBots').innerHTML = LEVELS.map(function (l) {
      var av = l.piece === 'logo' ? '<img src="' + LOGO_SRC + '" alt="">' : pcHtml('b' + l.piece);
      return '<button type="button" class="bot" data-quick="' + l.id + '" aria-pressed="false" title="' + esc(l.desc) + '"><span class="av">' + av + '</span><b>' + l.name + '</b><span>' + l.elo + (l.id === 7 ? '+' : '') + '</span></button>';
    }).join('');
    var cur = store.get('current', null);
    var rc = $('#resumeCard');
    if (cur && cur.cfg && cur.ucis) {
      rc.hidden = false;
      $('#resumeText').textContent = (cur.cfg.mode === 'bot' ? 'vs ' + levelById(cur.cfg.level).name : 'Pass and play') + ' · ' + tcLabel(cur.cfg.tc) + ' · move ' + (Math.floor(cur.ucis.length / 2) + 1);
    } else rc.hidden = true;
  }

  // ---------- setup ----------
  var setupMode = 'bot';
  function openSetup(mode) {
    setupMode = mode;
    $('#setupTitle').textContent = mode === 'bot' ? 'Play the bot' : 'Play a friend';
    $('#botSection').hidden = mode !== 'bot';
    $('#colorSection').hidden = mode !== 'bot';
    $('#namesSection').hidden = mode !== 'friend';
    renderSetup();
    show('setup');
  }
  function renderSetup() {
    $('#botGrid').innerHTML = LEVELS.map(function (l) {
      var av = l.piece === 'logo' ? '<img src="' + LOGO_SRC + '" alt="">' : pcHtml('b' + l.piece);
      return '<button type="button" class="bot" data-level="' + l.id + '" aria-pressed="' + (setup.level === l.id) + '"><span class="av">' + av + '</span><b>' + l.name + '</b><span>' + l.elo + (l.id === 7 ? '+' : '') + '</span></button>';
    }).join('');
    $('#botDesc').textContent = levelById(setup.level).desc;
    $$('#colorSeg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-color') === setup.color)); });
    var tc = setupMode === 'bot' ? setup.tc : setup.fTc;
    $('#tcGroups').innerHTML = TCS.map(function (g) {
      return '<div class="tc-group"><span>' + g.group + '</span>' + g.items.map(function (it) {
        return '<button type="button" class="tc" data-tc="' + it.join(',') + '" aria-pressed="' + (it[0] === tc[0] && it[1] === tc[1]) + '">' + (it[0] ? it[0] + ' + ' + it[1] : 'No clock') + '</button>';
      }).join('') + '</div>';
    }).join('');
    $('#nameW').value = setup.nameW; $('#nameB').value = setup.nameB;
    $('#autoFlipSw').setAttribute('aria-checked', String(!!setup.autoFlip));
    renderSwatches();
  }
  function renderSwatches() {
    var boardHtml = BOARDS.map(function (b) {
      var cells = '';
      for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
        var inner = '';
        if (y === 2 && x === 1) inner = pcHtml('wN', settings.pieces);
        if (y === 1 && x === 2) inner = pcHtml('bQ', settings.pieces);
        cells += '<i style="background:' + ((x + y) % 2 ? b.d : b.l) + '">' + inner + '</i>';
      }
      return '<button type="button" class="swatch" data-board="' + b.id + '" aria-pressed="' + (settings.board === b.id) + '"><span class="mini">' + cells + '</span>' + b.name + '</button>';
    }).join('');
    var cur = BOARDS.filter(function (b) { return b.id === settings.board; })[0] || BOARDS[0];
    var pieceHtml = SETS.map(function (s) {
      var cells = '', layout = { '0,0': 'bR', '1,0': 'bN', '2,0': 'bB', '3,0': 'bQ', '0,3': 'wK', '1,3': 'wB', '2,3': 'wN', '3,3': 'wP', '1,1': 'bP', '2,2': 'wP' };
      for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
        var code = layout[x + ',' + y];
        cells += '<i style="background:' + ((x + y) % 2 ? cur.d : cur.l) + '">' + (code ? pcHtml(code, s) : '') + '</i>';
      }
      return '<button type="button" class="swatch" data-pieces="' + s + '" aria-pressed="' + (settings.pieces === s) + '"><span class="mini">' + cells + '</span>' + MAS_PIECES[s].name + '</button>';
    }).join('');
    ['#boardSwatches', '#boardSwatches2'].forEach(function (id) { $(id).innerHTML = boardHtml; });
    ['#pieceSwatches', '#pieceSwatches2'].forEach(function (id) { $(id).innerHTML = pieceHtml; });
  }
  function startFromSetup() {
    Sound.init();
    var cfg;
    if (setupMode === 'bot') {
      var human = setup.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color;
      cfg = { mode: 'bot', level: setup.level, human: human, tc: setup.tc.slice(), names: { w: '', b: '' }, colorPref: setup.color };
    } else {
      setup.nameW = ($('#nameW').value || '').trim() || 'White';
      setup.nameB = ($('#nameB').value || '').trim() || 'Black';
      cfg = { mode: 'friend', human: 'w', tc: setup.fTc.slice(), names: { w: setup.nameW, b: setup.nameB }, autoFlip: !!setup.autoFlip };
    }
    store.set('setup', setup);
    startGame(cfg);
  }

  // ---------- settings ----------
  function renderSettings() {
    $('#themeOpts').innerHTML = THEMES.map(function (t) {
      return '<button type="button" class="theme-opt" data-theme-id="' + t.id + '" aria-pressed="' + (settings.theme === t.id) + '"><i style="background:' + t.bg + '"></i>' + t.name + '</button>';
    }).join('');
    $$('[data-set]').forEach(function (sw) { sw.setAttribute('aria-checked', String(!!settings[sw.getAttribute('data-set')])); });
    renderSwatches();
  }
  function saveSettings() { store.set('settings', settings); applyTheme(); }

  // ---------- modals ----------
  function openModal(id) { $(id).hidden = false; var f = $(id + ' .btn.primary') || $(id + ' button'); if (f) setTimeout(function () { f.focus(); }, 50); }
  function closeModals() { $$('.scrim').forEach(function (s) { s.hidden = true; }); }
  function openResult() {
    var rt = resultText();
    $('#resultTitle').textContent = rt.title;
    $('#resultWhy').textContent = rt.why || '';
    var ic = $('#resultIcon'); ic.className = 'result-icon ' + rt.kind;
    ic.innerHTML = icon(rt.kind === 'win' ? 'trophy' : rt.kind === 'loss' ? 'flag' : 'draw');
    $('#resultId').textContent = G.id + ' · ' + tcLabel(G.cfg.tc);
    var rcEl = $('#ratingChange');
    if (G.mode === 'bot' && !G.result.aborted) {
      if (G.rated) {
        var ch = G.ratingChange, cls = ch > 0 ? 'pos' : ch < 0 ? 'neg' : 'zero';
        rcEl.innerHTML = '<span>' + G.ratingBefore + '</span>' + icon('next') + '<span>' + G.ratingAfter + '</span><span class="delta ' + cls + '">' + (ch >= 0 ? '+' : '') + ch + '</span>';
      } else rcEl.innerHTML = '<span style="font-size:15px;font-family:var(--font-body)">Casual game. Your rating stays at ' + profile.rating + '.</span>';
      rcEl.hidden = false;
    } else rcEl.hidden = true;
    openModal('#resultModal');
  }

  // ============================================================ wiring
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-go]');
      if (t) {
        var where = t.getAttribute('data-go');
        if (where === 'home') goHome();
        else if (where === 'about') show('about');
        else if (where === 'back') { if (prevView === 'game' && G) show('game'); else goHome(); }
        return;
      }
      if (e.target.closest('[data-open="settings"]')) { renderSettings(); openModal('#settings'); return; }
      if (e.target.closest('[data-close]')) { closeModals(); return; }
      if (e.target.classList && e.target.classList.contains('scrim')) { closeModals(); return; }
      var quick = e.target.closest('.bot[data-quick]');
      if (quick) { Sound.init(); setup.level = +quick.getAttribute('data-quick'); store.set('setup', setup); openSetup('bot'); return; }
      var bot = e.target.closest('.bot');
      if (bot) { setup.level = +bot.getAttribute('data-level'); store.set('setup', setup); renderSetup(); return; }
      var col = e.target.closest('#colorSeg button');
      if (col) { setup.color = col.getAttribute('data-color'); store.set('setup', setup); renderSetup(); return; }
      var tc = e.target.closest('.tc');
      if (tc) { var v = tc.getAttribute('data-tc').split(',').map(Number); if (setupMode === 'bot') setup.tc = v; else setup.fTc = v; store.set('setup', setup); renderSetup(); return; }
      var bs = e.target.closest('.swatch[data-board]');
      if (bs) { settings.board = bs.getAttribute('data-board'); saveSettings(); renderSwatches(); return; }
      var ps = e.target.closest('.swatch[data-pieces]');
      if (ps) { settings.pieces = ps.getAttribute('data-pieces'); saveSettings(); renderSwatches(); if (G) renderPlayers(); return; }
      var th = e.target.closest('.theme-opt');
      if (th) { settings.theme = th.getAttribute('data-theme-id'); saveSettings(); renderSettings(); return; }
      var sw = e.target.closest('[data-set]');
      if (sw) {
        var k = sw.getAttribute('data-set'); settings[k] = !settings[k]; saveSettings(); renderSettings();
        if (k === 'coords') board.build();
        if (k === 'premove' && G) { G.premove = null; }
        if (G) renderMarks();
        return;
      }
      var mv = e.target.closest('.mv');
      if (mv) { navTo(+mv.getAttribute('data-ply')); return; }
    });
    $('#themeBtn').addEventListener('click', function () {
      var ids = THEMES.map(function (t) { return t.id; }), i = ids.indexOf(settings.theme);
      settings.theme = ids[(i + 1) % ids.length]; saveSettings();
      toast('Theme: ' + THEMES[(i + 1) % ids.length].name);
    });
    $('#autoFlipSw').addEventListener('click', function () { setup.autoFlip = !setup.autoFlip; store.set('setup', setup); renderSetup(); });
    $('#playBotBtn').addEventListener('click', function () { Sound.init(); openSetup('bot'); });
    $('#playFriendBtn').addEventListener('click', function () { Sound.init(); openSetup('friend'); });
    $('#startBtn').addEventListener('click', startFromSetup);
    $('#resumeBtn').addEventListener('click', function () {
      Sound.init();
      if (G && !G.over && !G.review && G.cfg) { show('game'); G.lastTick = now(); renderAll(); if (G.mode === 'bot' && G.chess.turn() !== G.human) scheduleBot(); return; }
      var cur = store.get('current', null); if (!cur) return;
      var cfg = cur.cfg; if (cur.rated === false) cfg.rated = false;
      startGame(cfg, cur.ucis, cur.clocks);
    });
    $('#discardBtn').addEventListener('click', function () { store.del('current'); if (G && !G.over) { G.botToken++; G = null; } renderHome(); toast('Game discarded'); });
    $('#navFirst').addEventListener('click', function () { navTo(0); });
    $('#navPrev').addEventListener('click', function () { navTo(G.viewPly - 1); });
    $('#navNext').addEventListener('click', function () { navTo(G.viewPly + 1); });
    $('#navLast').addEventListener('click', function () { navTo(G.fens.length - 1); });
    $('#actFlip').addEventListener('click', function () { board.setOrientation(other(board.orient)); renderPlayers(); renderMarks(); if (G.hint) board.drawArrows([G.hint]); });
    $('#actUndo').addEventListener('click', takeback);
    $('#actHint').addEventListener('click', hint);
    $('#actDraw').addEventListener('click', offerDraw);
    $('#actResign').addEventListener('click', resign);
    $('#resPdf').addEventListener('click', savePdf);
    $('#rvPdf').addEventListener('click', savePdf);
    $('#rvPgn').addEventListener('click', copyPgn);
    $('#rvReview').addEventListener('click', startReview);
    $('#resReview').addEventListener('click', startReview);
    $('#resRematch').addEventListener('click', rematch);
    $('#resNew').addEventListener('click', function () { closeModals(); openSetup(G ? G.mode : 'bot'); });
    $('#rvNew').addEventListener('click', function () { openSetup(G ? G.mode : 'bot'); });
    $('#evalGraph').addEventListener('click', function (e) {
      if (!G || !G.review || !G.review.done) return;
      var rc = this.getBoundingClientRect(); navTo(Math.round((e.clientX - rc.left) / rc.width * (G.fens.length - 1)));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModals(); if (G) { G.premove = null; deselect(); } return; }
      if (currentView !== 'game' || !G || /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { navTo(G.viewPly - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { navTo(G.viewPly + 1); e.preventDefault(); }
      else if (e.key === 'Home') { navTo(0); e.preventDefault(); }
      else if (e.key === 'End') { navTo(G.fens.length - 1); e.preventDefault(); }
      else if (e.key === 'f' || e.key === 'F') $('#actFlip').click();
    });
    // install prompt
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('#installCard').hidden = false; });
    $('#installBtn').addEventListener('click', function () {
      if (!deferred) return; deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; $('#installCard').hidden = true; });
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
  }
  function rematch() {
    if (!G) return;
    closeModals();
    var cfg = JSON.parse(JSON.stringify(G.cfg));
    delete cfg.id; delete cfg.startedAt; delete cfg.rated;
    if (cfg.mode === 'bot') cfg.human = other(G.human);
    else cfg.names = { w: G.cfg.names.b, b: G.cfg.names.w };
    startGame(cfg);
  }

  // ============================================================ boot
  function boot() {
    LOGO_SRC = ($('.hero-logo') || {}).src || '';
    applyTheme();
    Book.build();
    board = new Board($('#board'), handlers);
    bind();
    renderHome();
    setInterval(tick, 100);
    if (!window.MAS_EMBEDDED && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support unavailable */ });
    }
    window.ChessMAS = { get game() { return G; }, engine: Engine, levels: LEVELS };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
