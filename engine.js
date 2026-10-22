/*!
 * MAS Engine — the chess engine behind Chess.MAS
 * (c) MAS Studio · MD Al Shahriar · MIT License
 *
 * 0x88 board, iterative deepening PVS alpha-beta, transposition table,
 * null-move pruning, late-move reductions, killer/history ordering,
 * quiescence search and a tapered PeSTO evaluation with mop-up endgames.
 * Runs inside a Web Worker (or on the main thread as a fallback).
 */
function MASEngine() {
  'use strict';
  var WHITE = 0, BLACK = 1;
  var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var INF = 32000, MATE = 30000, MATE_BOUND = 29000;
  var FLAG_EP = 1, FLAG_CASTLE = 2, FLAG_DOUBLE = 3;
  var TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;
  var MAXPLY = 96, MAXMOVES = 256;
  var N_DIRS = [-33, -31, -18, -14, 14, 18, 31, 33];
  var B_DIRS = [-17, -15, 15, 17];
  var R_DIRS = [-16, -1, 1, 16];
  var K_DIRS = [-17, -16, -15, -1, 1, 15, 16, 17];
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var PHASE_INC = [0, 0, 1, 1, 2, 4, 0];

  // ---- PeSTO tables (a8 = index 0, white's point of view) ----
  var MG_VAL = [0, 82, 337, 365, 477, 1025, 0];
  var EG_VAL = [0, 94, 281, 297, 512, 936, 0];
  var PST_MG = [null,
    [0,0,0,0,0,0,0,0,98,134,61,95,68,126,34,-11,-6,7,26,31,65,56,25,-20,-14,13,6,21,23,12,17,-23,-27,-2,-5,12,17,6,10,-25,-26,-4,-4,-10,3,3,33,-12,-35,-1,-20,-23,-15,24,38,-22,0,0,0,0,0,0,0,0],
    [-167,-89,-34,-49,61,-97,-15,-107,-73,-41,72,36,23,62,7,-17,-47,60,37,65,84,129,73,44,-9,17,19,53,37,69,18,22,-13,4,16,13,28,19,21,-8,-23,-9,12,10,19,17,25,-16,-29,-53,-12,-3,-1,18,-14,-19,-105,-21,-58,-33,-17,-28,-19,-23],
    [-29,4,-82,-37,-25,-42,7,-8,-26,16,-18,-13,30,59,18,-47,-16,37,43,40,35,50,37,-2,-4,5,19,50,37,37,7,-2,-6,13,13,26,34,12,10,4,0,15,15,15,14,27,18,10,4,15,16,0,7,21,33,1,-33,-3,-14,-21,-13,-12,-39,-21],
    [32,42,32,51,63,9,31,43,27,32,58,62,80,67,26,44,-5,19,26,36,17,45,61,16,-24,-11,7,26,24,35,-8,-20,-36,-26,-12,-1,9,-7,6,-23,-45,-25,-16,-17,3,0,-5,-33,-44,-16,-20,-9,-1,11,-6,-71,-19,-13,1,17,16,7,-37,-26],
    [-28,0,29,12,59,44,43,45,-24,-39,-5,1,-16,57,28,54,-13,-17,7,8,29,56,47,57,-27,-27,-16,-16,-1,17,-2,1,-9,-26,-9,-10,-2,-4,3,-3,-14,2,-11,-2,-5,2,14,5,-35,-8,11,2,8,15,-3,1,-1,-18,-9,10,-15,-25,-31,-50],
    [-65,23,16,-15,-56,-34,2,13,29,-1,-20,-7,-8,-4,-38,-29,-9,24,2,-16,-20,6,22,-22,-17,-20,-12,-27,-30,-25,-14,-36,-49,-1,-27,-39,-46,-44,-33,-51,-14,-14,-22,-46,-44,-30,-15,-27,1,7,-8,-64,-43,-16,9,8,-15,36,12,-54,8,-28,24,14]
  ];
  var PST_EG = [null,
    [0,0,0,0,0,0,0,0,178,173,158,134,147,132,165,187,94,100,85,67,56,53,82,84,32,24,13,5,-2,4,17,17,13,9,-3,-7,-7,-8,3,-1,4,7,-6,1,0,-5,-1,-8,13,8,8,10,13,0,2,-7,0,0,0,0,0,0,0,0],
    [-58,-38,-13,-28,-31,-27,-63,-99,-25,-8,-25,-2,-9,-25,-24,-52,-24,-20,10,9,-1,-9,-19,-41,-17,3,22,22,22,11,8,-18,-18,-6,16,25,16,17,4,-18,-23,-3,-1,15,10,-3,-20,-22,-42,-20,-10,-5,-2,-20,-23,-44,-29,-51,-23,-15,-22,-18,-50,-64],
    [-14,-21,-11,-8,-7,-9,-17,-24,-8,-4,7,-12,-3,-13,-4,-14,2,-8,0,-1,-2,6,0,4,-3,9,12,9,14,10,3,2,-6,3,13,19,7,10,-3,-9,-12,-3,8,10,13,3,-7,-15,-14,-18,-7,-1,4,-9,-15,-27,-23,-9,-23,-5,-9,-16,-5,-17],
    [13,10,18,15,12,12,8,5,11,13,13,11,-3,3,8,3,7,7,7,5,4,-3,-5,-3,4,3,13,1,2,1,-1,2,3,5,8,4,-5,-6,-8,-11,-4,0,-5,-1,-7,-12,-8,-16,-6,-6,0,2,-9,-9,-11,-3,-9,2,3,-1,-5,-13,4,-20],
    [-9,22,22,27,27,19,10,20,-17,20,32,41,58,25,30,0,-20,6,9,49,47,35,19,9,3,22,24,45,57,40,57,36,-18,28,19,47,31,34,39,23,-16,-27,15,6,9,17,10,5,-22,-23,-30,-16,-16,-23,-36,-32,-33,-28,-22,-43,-5,-32,-20,-41],
    [-74,-35,-18,-18,-11,15,4,-17,-12,17,14,17,17,38,23,11,10,17,23,15,20,45,44,13,-8,22,24,27,26,33,26,3,-18,-4,21,24,27,23,9,-11,-19,-3,11,21,23,16,7,-9,-27,-11,4,13,14,4,-5,-17,-53,-34,-21,-11,-28,-14,-24,-43]
  ];

  var MG = new Int16Array(16 * 128), EG = new Int16Array(16 * 128);
  (function buildTables() {
    for (var t = 1; t <= 6; t++) {
      for (var sq = 0; sq < 128; sq++) {
        if (sq & 0x88) continue;
        var f = sq & 7, r = sq >> 4;
        var wi = (7 - r) * 8 + f, bi = r * 8 + f;
        MG[t * 128 + sq] = MG_VAL[t] + PST_MG[t][wi];
        EG[t * 128 + sq] = EG_VAL[t] + PST_EG[t][wi];
        MG[(8 | t) * 128 + sq] = MG_VAL[t] + PST_MG[t][bi];
        EG[(8 | t) * 128 + sq] = EG_VAL[t] + PST_EG[t][bi];
      }
    }
  })();

  // ---- Zobrist ----
  var seed = 0x2545F491;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var ZL = new Int32Array(16 * 128), ZH = new Int32Array(16 * 128);
  var ZEPL = new Int32Array(128), ZEPH = new Int32Array(128);
  var ZCL = new Int32Array(16), ZCH = new Int32Array(16);
  for (var zi = 0; zi < 16 * 128; zi++) { ZL[zi] = rnd(); ZH[zi] = rnd(); }
  for (zi = 0; zi < 128; zi++) { ZEPL[zi] = rnd(); ZEPH[zi] = rnd(); }
  for (zi = 0; zi < 16; zi++) { ZCL[zi] = rnd(); ZCH[zi] = rnd(); }
  var ZSL = rnd(), ZSH = rnd();

  var CMASK = new Int8Array(128);
  for (zi = 0; zi < 128; zi++) CMASK[zi] = 15;
  CMASK[0] = 13; CMASK[7] = 14; CMASK[4] = 12; CMASK[112] = 7; CMASK[119] = 11; CMASK[116] = 3;

  // ---- position state ----
  var board = new Int8Array(128);
  var side = WHITE, castle = 0, ep = -1, half = 0;
  var kingSq = [4, 116];
  var mgS = [0, 0], egS = [0, 0], mat = [0, 0], pawns = [0, 0], bishops = [0, 0], minors = [0, 0];
  var phase = 0;
  var hLo = 0, hHi = 0;

  var STACK = 1024;
  var uMove = new Int32Array(STACK), uCap = new Int8Array(STACK), uCastle = new Int8Array(STACK),
      uEp = new Int16Array(STACK), uHalf = new Int16Array(STACK), uLo = new Int32Array(STACK), uHi = new Int32Array(STACK);
  var sp = 0;
  var histLo = new Int32Array(STACK + 8), histHi = new Int32Array(STACK + 8), histLen = 0;

  function put(sq, p) {
    board[sq] = p;
    var c = p >> 3, t = p & 7, i = p * 128 + sq;
    mgS[c] += MG[i]; egS[c] += EG[i]; phase += PHASE_INC[t]; mat[c] += VAL[t];
    if (t === PAWN) pawns[c]++; else if (t === BISHOP) { bishops[c]++; minors[c]++; } else if (t === KNIGHT) minors[c]++;
  }
  function clr(sq) {
    var p = board[sq]; board[sq] = 0;
    var c = p >> 3, t = p & 7, i = p * 128 + sq;
    mgS[c] -= MG[i]; egS[c] -= EG[i]; phase -= PHASE_INC[t]; mat[c] -= VAL[t];
    if (t === PAWN) pawns[c]--; else if (t === BISHOP) { bishops[c]--; minors[c]--; } else if (t === KNIGHT) minors[c]--;
  }
  function hashPiece(sq, p) { var i = p * 128 + sq; hLo ^= ZL[i]; hHi ^= ZH[i]; }

  function reset() {
    for (var i = 0; i < 128; i++) board[i] = 0;
    mgS[0] = mgS[1] = egS[0] = egS[1] = mat[0] = mat[1] = pawns[0] = pawns[1] = bishops[0] = bishops[1] = minors[0] = minors[1] = 0;
    phase = 0; side = WHITE; castle = 0; ep = -1; half = 0; sp = 0; hLo = 0; hHi = 0; histLen = 0;
  }

  function sqName(sq) { return 'abcdefgh'[sq & 7] + ((sq >> 4) + 1); }
  function parseSq(s) { return (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97); }

  function setFen(fen) {
    reset();
    var parts = fen.trim().split(/\s+/);
    var rows = parts[0].split('/');
    var map = { p: 9, n: 10, b: 11, r: 12, q: 13, k: 14, P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6 };
    for (var r = 0; r < 8; r++) {
      var f = 0, row = rows[r] || '';
      for (var k = 0; k < row.length; k++) {
        var ch = row[k];
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        var sq = (7 - r) * 16 + f, p = map[ch];
        if (p) { put(sq, p); hashPiece(sq, p); if ((p & 7) === KING) kingSq[p >> 3] = sq; }
        f++;
      }
    }
    side = parts[1] === 'b' ? BLACK : WHITE;
    var c = parts[2] || '-';
    castle = (c.indexOf('K') >= 0 ? 1 : 0) | (c.indexOf('Q') >= 0 ? 2 : 0) | (c.indexOf('k') >= 0 ? 4 : 0) | (c.indexOf('q') >= 0 ? 8 : 0);
    ep = parts[3] && parts[3] !== '-' ? parseSq(parts[3]) : -1;
    half = parseInt(parts[4] || '0', 10) || 0;
    if (side === BLACK) { hLo ^= ZSL; hHi ^= ZSH; }
    hLo ^= ZCL[castle]; hHi ^= ZCH[castle];
    if (ep >= 0) { hLo ^= ZEPL[ep]; hHi ^= ZEPH[ep]; }
    histLo[0] = hLo; histHi[0] = hHi; histLen = 1;
  }

  // ---- attacks ----
  function attacked(sq, by) {
    var t, x, d, i;
    if (by === WHITE) {
      t = sq - 15; if (!(t & 0x88) && board[t] === 1) return true;
      t = sq - 17; if (!(t & 0x88) && board[t] === 1) return true;
    } else {
      t = sq + 15; if (!(t & 0x88) && board[t] === 9) return true;
      t = sq + 17; if (!(t & 0x88) && board[t] === 9) return true;
    }
    var bc = by << 3, kn = bc | KNIGHT, kg = bc | KING, bi = bc | BISHOP, ro = bc | ROOK, qu = bc | QUEEN;
    for (i = 0; i < 8; i++) { t = sq + N_DIRS[i]; if (!(t & 0x88) && board[t] === kn) return true; }
    for (i = 0; i < 8; i++) { t = sq + K_DIRS[i]; if (!(t & 0x88) && board[t] === kg) return true; }
    for (i = 0; i < 4; i++) {
      d = B_DIRS[i]; t = sq + d;
      while (!(t & 0x88)) { x = board[t]; if (x) { if (x === bi || x === qu) return true; break; } t += d; }
    }
    for (i = 0; i < 4; i++) {
      d = R_DIRS[i]; t = sq + d;
      while (!(t & 0x88)) { x = board[t]; if (x) { if (x === ro || x === qu) return true; break; } t += d; }
    }
    return false;
  }
  function inCheckNow() { return attacked(kingSq[side], side ^ 1); }

  // ---- move generation ----
  var moves = new Int32Array(MAXPLY * MAXMOVES), mscore = new Int32Array(MAXPLY * MAXMOVES);
  function enc(from, to, promo, flag) { return from | (to << 7) | (promo << 14) | (flag << 17); }

  function gen(base, capsOnly) {
    var n = base, us = side, them = us ^ 1, sq, p, t, i, d, c, x;
    for (sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = board[sq];
      if (!p || (p >> 3) !== us) continue;
      t = p & 7;
      if (t === PAWN) {
        var dir = us === WHITE ? 16 : -16, startR = us === WHITE ? 1 : 6, promoR = us === WHITE ? 7 : 0;
        for (i = -1; i <= 1; i += 2) {
          c = sq + dir + i;
          if (c & 0x88) continue;
          x = board[c];
          if (x && (x >> 3) === them) {
            if ((c >> 4) === promoR) {
              moves[n++] = enc(sq, c, QUEEN, 0);
              moves[n++] = enc(sq, c, KNIGHT, 0);
              if (!capsOnly) { moves[n++] = enc(sq, c, ROOK, 0); moves[n++] = enc(sq, c, BISHOP, 0); }
            } else moves[n++] = enc(sq, c, 0, 0);
          } else if (c === ep && !x) moves[n++] = enc(sq, c, 0, FLAG_EP);
        }
        c = sq + dir;
        if (!(c & 0x88) && !board[c]) {
          if ((c >> 4) === promoR) {
            moves[n++] = enc(sq, c, QUEEN, 0);
            if (!capsOnly) { moves[n++] = enc(sq, c, KNIGHT, 0); moves[n++] = enc(sq, c, ROOK, 0); moves[n++] = enc(sq, c, BISHOP, 0); }
          } else if (!capsOnly) {
            moves[n++] = enc(sq, c, 0, 0);
            if ((sq >> 4) === startR && !board[c + dir]) moves[n++] = enc(sq, c + dir, 0, FLAG_DOUBLE);
          }
        }
      } else if (t === KNIGHT || t === KING) {
        var dirs = t === KNIGHT ? N_DIRS : K_DIRS;
        for (i = 0; i < 8; i++) {
          c = sq + dirs[i];
          if (c & 0x88) continue;
          x = board[c];
          if (!x) { if (!capsOnly) moves[n++] = enc(sq, c, 0, 0); }
          else if ((x >> 3) === them) moves[n++] = enc(sq, c, 0, 0);
        }
        if (t === KING && !capsOnly) {
          if (us === WHITE && sq === 4) {
            if ((castle & 1) && !board[5] && !board[6] && board[7] === 4 && !attacked(4, them) && !attacked(5, them) && !attacked(6, them)) moves[n++] = enc(4, 6, 0, FLAG_CASTLE);
            if ((castle & 2) && !board[3] && !board[2] && !board[1] && board[0] === 4 && !attacked(4, them) && !attacked(3, them) && !attacked(2, them)) moves[n++] = enc(4, 2, 0, FLAG_CASTLE);
          } else if (us === BLACK && sq === 116) {
            if ((castle & 4) && !board[117] && !board[118] && board[119] === 12 && !attacked(116, them) && !attacked(117, them) && !attacked(118, them)) moves[n++] = enc(116, 118, 0, FLAG_CASTLE);
            if ((castle & 8) && !board[115] && !board[114] && !board[113] && board[112] === 12 && !attacked(116, them) && !attacked(115, them) && !attacked(114, them)) moves[n++] = enc(116, 114, 0, FLAG_CASTLE);
          }
        }
      } else {
        var sd = t === BISHOP ? B_DIRS : t === ROOK ? R_DIRS : K_DIRS;
        var nd = sd.length;
        for (i = 0; i < nd; i++) {
          d = sd[i]; c = sq + d;
          while (!(c & 0x88)) {
            x = board[c];
            if (!x) { if (!capsOnly) moves[n++] = enc(sq, c, 0, 0); }
            else { if ((x >> 3) === them) moves[n++] = enc(sq, c, 0, 0); break; }
            c += d;
          }
        }
      }
    }
    return n;
  }

  // ---- make / unmake ----
  function make(m) {
    var from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
    var p = board[from], cap = board[to], capSq = to;
    if (flag === FLAG_EP) { capSq = side === WHITE ? to - 16 : to + 16; cap = board[capSq]; }
    uMove[sp] = m; uCap[sp] = cap; uCastle[sp] = castle; uEp[sp] = ep; uHalf[sp] = half; uLo[sp] = hLo; uHi[sp] = hHi; sp++;
    if (ep >= 0) { hLo ^= ZEPL[ep]; hHi ^= ZEPH[ep]; }
    hLo ^= ZCL[castle]; hHi ^= ZCH[castle];
    if (cap) { hashPiece(capSq, cap); clr(capSq); }
    hashPiece(from, p); clr(from);
    var np = promo ? ((side << 3) | promo) : p;
    put(to, np); hashPiece(to, np);
    if (flag === FLAG_CASTLE) {
      var rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
      var rk = board[rf]; hashPiece(rf, rk); clr(rf); put(rt, rk); hashPiece(rt, rk);
    }
    if ((p & 7) === KING) kingSq[side] = to;
    castle &= CMASK[from] & CMASK[to];
    ep = -1;
    if (flag === FLAG_DOUBLE) { ep = side === WHITE ? from + 16 : from - 16; hLo ^= ZEPL[ep]; hHi ^= ZEPH[ep]; }
    hLo ^= ZCL[castle]; hHi ^= ZCH[castle];
    half = (cap || (p & 7) === PAWN) ? 0 : half + 1;
    side ^= 1; hLo ^= ZSL; hHi ^= ZSH;
    histLo[histLen] = hLo; histHi[histLen] = hHi; histLen++;
  }
  function unmake() {
    sp--; histLen--;
    var m = uMove[sp], from = m & 127, to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
    side ^= 1;
    var p = board[to];
    clr(to);
    put(from, promo ? ((side << 3) | PAWN) : p);
    if ((p & 7) === KING) kingSq[side] = from;
    var cap = uCap[sp];
    if (cap) { if (flag === FLAG_EP) put(side === WHITE ? to - 16 : to + 16, cap); else put(to, cap); }
    if (flag === FLAG_CASTLE) {
      var rf, rt;
      if (to === 6) { rf = 7; rt = 5; } else if (to === 2) { rf = 0; rt = 3; } else if (to === 118) { rf = 119; rt = 117; } else { rf = 112; rt = 115; }
      var rk = board[rt]; clr(rt); put(rf, rk);
    }
    castle = uCastle[sp]; ep = uEp[sp]; half = uHalf[sp]; hLo = uLo[sp]; hHi = uHi[sp];
  }
  var nullEp = new Int16Array(MAXPLY), nullLo = new Int32Array(MAXPLY), nullHi = new Int32Array(MAXPLY), nullHalf = new Int16Array(MAXPLY);
  function makeNull(ply) {
    nullEp[ply] = ep; nullLo[ply] = hLo; nullHi[ply] = hHi; nullHalf[ply] = half;
    if (ep >= 0) { hLo ^= ZEPL[ep]; hHi ^= ZEPH[ep]; }
    ep = -1; side ^= 1; hLo ^= ZSL; hHi ^= ZSH; half = 0;
    histLo[histLen] = hLo; histHi[histLen] = hHi; histLen++;
  }
  function unmakeNull(ply) {
    histLen--; side ^= 1; ep = nullEp[ply]; hLo = nullLo[ply]; hHi = nullHi[ply]; half = nullHalf[ply];
  }

  function legalMoves() {
    var n = gen(0, false), out = [];
    for (var i = 0; i < n; i++) {
      var m = moves[i];
      make(m);
      if (!attacked(kingSq[side ^ 1], side)) out.push(m);
      unmake();
    }
    return out;
  }
  function moveToUci(m) {
    var promo = (m >> 14) & 7;
    return sqName(m & 127) + sqName((m >> 7) & 127) + (promo ? ' nbrq'[promo - 1] : '');
  }
  function findMove(uci) {
    var list = legalMoves();
    for (var i = 0; i < list.length; i++) if (moveToUci(list[i]) === uci) return list[i];
    // tolerate a missing promotion letter (default queen)
    for (i = 0; i < list.length; i++) if (moveToUci(list[i]) === uci + 'q') return list[i];
    return 0;
  }
  function setPosition(fen, uciMoves) {
    setFen(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    if (uciMoves) for (var i = 0; i < uciMoves.length; i++) {
      var m = findMove(uciMoves[i]);
      if (!m) break;
      make(m);
      sp = 0; // game moves are not undone by the search
    }
  }

  // ---- evaluation ----
  function centerDist(sq) { var f = sq & 7, r = sq >> 4; return Math.max(3 - f, f - 4) + Math.max(3 - r, r - 4); }
  function kingDist(a, b) { return Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 4) - (b >> 4))); }
  function insufficient() {
    if (pawns[0] || pawns[1]) return false;
    var nw = mat[0], nb = mat[1];
    return nw <= 330 && nb <= 330;
  }
  function evaluate() {
    var ph = phase > 24 ? 24 : phase;
    var mg = mgS[0] - mgS[1], eg = egS[0] - egS[1];
    if (bishops[0] >= 2) { mg += 30; eg += 50; }
    if (bishops[1] >= 2) { mg -= 30; eg -= 50; }
    var s = ((mg * ph + eg * (24 - ph)) / 24) | 0;
    // endgame knowledge
    if (!pawns[0] && !pawns[1]) {
      var diff = mat[0] - mat[1];
      if (Math.abs(diff) < 400) s = (s / 8) | 0;               // e.g. R vs R+minor, minor vs minor: drawish
      else {
        var strong = diff > 0 ? WHITE : BLACK, weak = strong ^ 1;
        var bonus = 10 * centerDist(kingSq[weak]) + 4 * (14 - 2 * kingDist(kingSq[0], kingSq[1]));
        s += strong === WHITE ? bonus : -bonus;
      }
    } else if (!pawns[0] && mat[0] <= 330 && s > 0) s = (s / 8) | 0;  // a lone minor cannot win
    else if (!pawns[1] && mat[1] <= 330 && s < 0) s = (s / 8) | 0;
    return (side === WHITE ? s : -s) + 12;
  }

  // ---- search ----
  var TT_BITS = 19, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  var ttKey = new Int32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE),
      ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE);
  var killers = new Int32Array(MAXPLY * 2), history = new Int32Array(2 * 128 * 128);
  var nodes = 0, stopTime = 0, stopped = false, nodeLimit = 0, useQ = true;
  var rootBest = 0, rootScore = 0;
  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };

  function clearTT() { ttKey.fill(0); ttMove.fill(0); ttDepth.fill(0); ttFlag.fill(0); }

  function checkTime() {
    if (now() >= stopTime || (nodeLimit && nodes >= nodeLimit)) stopped = true;
  }
  function isRepetition() {
    var stop = histLen - 1 - half; if (stop < 0) stop = 0;
    for (var i = histLen - 3; i >= stop; i -= 2) if (histLo[i] === hLo && histHi[i] === hHi) return true;
    return false;
  }
  function scoreMoves(base, n, ttMv, ply) {
    var k1 = killers[ply * 2], k2 = killers[ply * 2 + 1];
    for (var i = base; i < n; i++) {
      var m = moves[i], to = (m >> 7) & 127, from = m & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
      var s;
      if (m === ttMv) s = 50000000;
      else {
        var victim = board[to] & 7;
        if (flag === FLAG_EP) victim = PAWN;
        if (victim) s = 10000000 + VAL[victim] * 10 - (board[from] & 7);
        else if (promo === QUEEN) s = 9000000;
        else if (m === k1) s = 8000000;
        else if (m === k2) s = 7000000;
        else s = history[side * 16384 + from * 128 + to];
        if (promo && promo !== QUEEN) s -= 2000000;
      }
      mscore[i] = s;
    }
  }
  function pick(i, n) {
    var bi = i, bs = mscore[i];
    for (var j = i + 1; j < n; j++) if (mscore[j] > bs) { bs = mscore[j]; bi = j; }
    if (bi !== i) {
      var tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm;
      var ts = mscore[i]; mscore[i] = mscore[bi]; mscore[bi] = ts;
    }
    return moves[i];
  }
  function hasNonPawn(c) { return mat[c] - pawns[c] * 100 > 0; }

  function quiesce(alpha, beta, ply) {
    if ((++nodes & 2047) === 0) checkTime();
    if (stopped) return 0;
    var stand = evaluate();
    if (ply >= MAXPLY - 1) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    var base = ply * MAXMOVES, n = gen(base, true);
    scoreMoves(base, n, 0, ply);
    var best = stand;
    for (var i = base; i < n; i++) {
      var m = pick(i, n);
      var to = (m >> 7) & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
      var victim = flag === FLAG_EP ? PAWN : (board[to] & 7);
      if (!promo && stand + VAL[victim] + 200 < alpha) continue;
      make(m);
      if (attacked(kingSq[side ^ 1], side)) { unmake(); continue; }
      var sc = -quiesce(-beta, -alpha, ply + 1);
      unmake();
      if (stopped) return 0;
      if (sc > best) { best = sc; if (sc > alpha) { alpha = sc; if (sc >= beta) break; } }
    }
    return best;
  }

  function negamax(depth, alpha, beta, ply, nullOk) {
    if ((++nodes & 2047) === 0) checkTime();
    if (stopped) return 0;
    var pv = beta - alpha > 1;
    if (ply > 0) {
      if (half >= 100 || isRepetition() || insufficient()) return 0;
      var ma = -MATE + ply, mb = MATE - ply - 1;
      if (ma > alpha) alpha = ma;
      if (mb < beta) beta = mb;
      if (alpha >= beta) return alpha;
    }
    var check = attacked(kingSq[side], side ^ 1);
    if (check) depth++;
    if (depth <= 0) return useQ ? quiesce(alpha, beta, ply) : evaluate();
    if (ply >= MAXPLY - 1) return evaluate();

    var idx = hLo & TT_MASK, ttMv = 0, sc;
    if (ttKey[idx] === hHi && ttFlag[idx]) {
      ttMv = ttMove[idx];
      if (!pv && ply > 0 && ttDepth[idx] >= depth) {
        sc = ttScore[idx];
        if (sc > MATE_BOUND) sc -= ply; else if (sc < -MATE_BOUND) sc += ply;
        var f = ttFlag[idx];
        if (f === TT_EXACT || (f === TT_LOWER && sc >= beta) || (f === TT_UPPER && sc <= alpha)) return sc;
      }
    }
    var staticEval = check ? -INF : evaluate();
    if (!check && !pv && ply > 0) {
      if (depth <= 6 && staticEval - 85 * depth >= beta && Math.abs(beta) < MATE_BOUND) return staticEval;
      if (nullOk && depth >= 3 && staticEval >= beta && hasNonPawn(side)) {
        var R = depth > 6 ? 3 : 2;
        makeNull(ply);
        sc = -negamax(depth - 1 - R, -beta, -beta + 1, ply + 1, false);
        unmakeNull(ply);
        if (stopped) return 0;
        if (sc >= beta) return sc > MATE_BOUND ? beta : sc;
      }
    }

    var base = ply * MAXMOVES, n = gen(base, false);
    scoreMoves(base, n, ttMv, ply);
    var best = -INF, bestMv = 0, legal = 0, oldAlpha = alpha;
    for (var i = base; i < n; i++) {
      var m = pick(i, n);
      var to = (m >> 7) & 127, from = m & 127, promo = (m >> 14) & 7, flag = (m >> 17) & 7;
      var quiet = !board[to] && flag !== FLAG_EP && !promo;
      make(m);
      if (attacked(kingSq[side ^ 1], side)) { unmake(); continue; }
      legal++;
      var givesCheck = attacked(kingSq[side], side ^ 1);
      if (quiet && !check && !givesCheck && !pv && legal > 1 && depth <= 2 && staticEval + 140 * depth <= alpha) { unmake(); continue; }
      if (legal === 1) sc = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        var red = 0;
        if (depth >= 3 && legal > 3 && quiet && !check && !givesCheck) {
          red = 1;
          if (legal > 8) red++;
          if (depth > 6 && legal > 14) red++;
          if (pv && red > 0) red--;
        }
        sc = -negamax(depth - 1 - red, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && red > 0 && !stopped) sc = -negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && sc < beta && !stopped) sc = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      unmake();
      if (stopped) return 0;
      if (sc > best) {
        best = sc; bestMv = m;
        if (sc > alpha) {
          alpha = sc;
          if (ply === 0) { rootBest = m; rootScore = sc; }
          if (sc >= beta) {
            if (quiet) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              var hi = side * 16384 + from * 128 + to;
              history[hi] += depth * depth;
              if (history[hi] > 6000000) for (var h = 0; h < history.length; h++) history[h] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return check ? -MATE + ply : 0;
    var store = best;
    if (store > MATE_BOUND) store += ply; else if (store < -MATE_BOUND) store -= ply;
    ttKey[idx] = hHi; ttMove[idx] = bestMv; ttScore[idx] = store; ttDepth[idx] = depth;
    ttFlag[idx] = best >= beta ? TT_LOWER : best > oldAlpha ? TT_EXACT : TT_UPPER;
    return best;
  }

  function resetSearch(timeMs, nodeCap) {
    nodes = 0; stopped = false; stopTime = now() + timeMs; nodeLimit = nodeCap || 0;
    killers.fill(0);
    for (var h = 0; h < history.length; h++) history[h] >>= 2;
  }

  // Full-strength iterative deepening search.
  function think(opts) {
    var timeMs = opts.timeMs || 1000, maxDepth = opts.maxDepth || 64;
    var t0 = now();
    resetSearch(timeMs, opts.nodes);
    useQ = true;
    var legal = legalMoves();
    if (!legal.length) return { move: null, score: inCheckNow() ? -MATE : 0, depth: 0, nodes: 0 };
    if (legal.length === 1 && !opts.analysis) return { move: moveToUci(legal[0]), score: evaluate(), depth: 0, nodes: 0 };
    var bestMove = legal[0], bestScore = 0, done = 0;
    for (var d = 1; d <= maxDepth; d++) {
      var delta = 30, alpha = -INF, beta = INF, sc;
      if (d >= 4) { alpha = bestScore - delta; beta = bestScore + delta; }
      while (true) {
        rootBest = 0;
        sc = negamax(d, alpha, beta, 0, false);
        if (stopped) break;
        if (sc <= alpha) { alpha = Math.max(-INF, sc - delta); delta *= 2; }
        else if (sc >= beta) { beta = Math.min(INF, sc + delta); delta *= 2; if (rootBest) bestMove = rootBest; }
        else break;
        if (delta > 600) { alpha = -INF; beta = INF; }
      }
      if (stopped) { if (rootBest && d > 1) bestMove = rootBest; break; }
      if (rootBest) bestMove = rootBest;
      bestScore = sc; done = d;
      if (Math.abs(sc) > MATE_BOUND && d >= (MATE - Math.abs(sc)) + 2) break;
      if (!opts.analysis && now() - t0 > timeMs * 0.5) break;
    }
    return { move: moveToUci(bestMove), score: bestScore, depth: done, nodes: nodes, ms: Math.round(now() - t0) };
  }

  // Shallow search of every root move, for the weaker levels: lets them
  // pick a "reasonable but imperfect" move instead of the single best one.
  function rootScores(depth, quiescence, timeMs) {
    resetSearch(timeMs || 3000, 0);
    useQ = quiescence;
    var legal = legalMoves(), out = [];
    for (var i = 0; i < legal.length; i++) {
      make(legal[i]);
      var sc = -negamax(depth - 1, -INF, INF, 1, true);
      unmake();
      if (stopped) break;
      out.push({ move: legal[i], score: sc });
    }
    useQ = true;
    return out;
  }

  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // Level-aware move choice. opts: { mode:'scores'|'search', depth, quiescence, noise, random, timeMs, maxDepth }
  function play(opts) {
    var legal = legalMoves();
    if (!legal.length) return { move: null };
    if (legal.length === 1) return { move: moveToUci(legal[0]), score: 0, depth: 0 };
    if (opts.mode === 'scores') {
      if (opts.random && Math.random() < opts.random) {
        return { move: moveToUci(legal[(Math.random() * legal.length) | 0]), score: 0, depth: 0, random: true };
      }
      var list = rootScores(opts.depth || 1, opts.quiescence !== false, opts.timeMs);
      if (!list.length) return { move: moveToUci(legal[0]) };
      var best = null, bs = -Infinity, top = -Infinity;
      for (var i = 0; i < list.length; i++) if (list[i].score > top) top = list[i].score;
      for (i = 0; i < list.length; i++) {
        var s = list[i].score;
        // never miss a forced mate in one, never walk into one if avoidable at higher levels
        if (s > MATE_BOUND && opts.seeMates) s += 100000;
        s += gauss() * (opts.noise || 0);
        if (s > bs) { bs = s; best = list[i]; }
      }
      return { move: moveToUci(best.move), score: best.score, depth: opts.depth };
    }
    return think({ timeMs: opts.timeMs, maxDepth: opts.maxDepth });
  }

  function perft(depth) {
    if (depth === 0) return 1;
    var base = (MAXPLY - 8 + depth) * MAXMOVES, n = gen(base, false), total = 0;
    for (var i = base; i < n; i++) {
      make(moves[i]);
      if (!attacked(kingSq[side ^ 1], side)) total += perft(depth - 1);
      unmake();
    }
    return total;
  }

  return {
    setPosition: setPosition,
    think: think,
    play: play,
    perft: perft,
    clearTT: clearTT,
    evaluate: function () { return evaluate(); },
    sideToMove: function () { return side; },
    legalUci: function () { return legalMoves().map(moveToUci); },
    inCheck: inCheckNow
  };
}

// Worker entry point: posts results for {type:'play'|'think'|'analyze'} jobs.
function MASEngineWorker() {
  var E = MASEngine();
  self.onmessage = function (e) {
    var d = e.data;
    try {
      if (d.type === 'play') {
        E.setPosition(d.fen, d.moves);
        var r = E.play(d.opts);
        self.postMessage({ id: d.id, type: 'play', result: r });
      } else if (d.type === 'think') {
        E.setPosition(d.fen, d.moves);
        self.postMessage({ id: d.id, type: 'think', result: E.think(d.opts) });
      } else if (d.type === 'analyze') {
        // d.positions: array of {fen, moves}; each gets a fixed-time search
        var out = [];
        for (var i = 0; i < d.positions.length; i++) {
          var pos = d.positions[i];
          E.setPosition(pos.fen, pos.moves);
          var res = E.think({ timeMs: d.opts.timeMs, maxDepth: d.opts.maxDepth, analysis: true });
          var white = E.sideToMove() === 0;
          out.push({ move: res.move, score: res.score === undefined ? 0 : (white ? res.score : -res.score), depth: res.depth });
          self.postMessage({ id: d.id, type: 'progress', done: i + 1, total: d.positions.length });
        }
        self.postMessage({ id: d.id, type: 'analyze', result: out });
      } else if (d.type === 'newgame') {
        E.clearTT();
        self.postMessage({ id: d.id, type: 'newgame', result: true });
      } else {
        self.postMessage({ id: d.id, type: 'error', message: 'unknown job ' + d.type });
      }
    } catch (err) {
      self.postMessage({ id: d.id, type: 'error', message: String(err && err.message || err) });
    }
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { MASEngine: MASEngine };
