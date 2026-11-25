(()=>{

// motion.js - the twelve motions from the motion pack spec (motion-pack-20261021/SPEC.md),
// written for the browser. Every function takes frame numbers (30 fps) and returns plain numbers.
// No drawing in here.
const M = (() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const easeIn = t => Math.pow(clamp(t), 3);
  const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const prog = (f, start, len) => clamp((f - start) / Math.max(1, len));

  // seeded random so every render of the same brief is identical
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // 1 pop-in: 0 -> 1.12 over 5 f, 1.12 -> 1 over 3 f, opacity over the first 3 f
  function popIn(f, start) {
    const d = f - start;
    if (d < 0) return { scale: 0, alpha: 0 };
    const scale = d < 5 ? lerp(0, 1.12, easeOut(d / 5)) : lerp(1.12, 1, easeOut((d - 5) / 3));
    return { scale, alpha: clamp(d / 3) };
  }

  // 2 slide: 4 f anticipation (3% the wrong way), n f travel, 2 f overshoot (3%), 2 f settle
  function slide(f, start, from, to, n = 12) {
    const d = f - start, dist = to - from;
    if (d <= 0) return from;
    if (d < 4) return from - dist * 0.03 * easeOut(d / 4);
    if (d < 4 + n) return lerp(from - dist * 0.03, to + dist * 0.03, easeOut((d - 4) / n));
    if (d < 4 + n + 2) return to + dist * 0.03;
    return lerp(to + dist * 0.03, to, easeOut((d - 4 - n - 2) / 2));
  }

  // 3 drop-bounce: 6 f fall (ease-in), contact on frame 7, bounce up 15% and back
  function dropBounce(f, start, fromY, toY) {
    const d = f - start, h = toY - fromY;
    if (d <= 0) return { y: fromY, contact: false };
    if (d < 6) return { y: lerp(fromY, toY, easeIn(d / 6)), contact: false };
    if (d < 7) return { y: toY, contact: true };
    if (d < 10) return { y: toY - h * 0.15 * easeOut((d - 7) / 3), contact: false };
    if (d < 13) return { y: toY - h * 0.15 * (1 - easeIn((d - 10) / 3)), contact: false };
    return { y: toY, contact: false };
  }

  // 4 punch-zoom: 1.00 -> amt over len f (ease-out), then hold
  const punchZoom = (f, start, amt = 1.08, len = 6) => f < start ? 1 : lerp(1, amt, easeOut((f - start) / len));

  // 5 hit: impact frame, then shake 8, 8, 4, 4, 2, 2 px alternating, then still
  function hit(f, start) {
    const d = f - start;
    if (d < 0 || d > 6) return { flash: 0, dx: 0, dy: 0 };
    const amp = [0, 8, 8, 4, 4, 2, 2][d], sign = d % 2 ? 1 : -1;
    return { flash: d === 0 ? 1 : 0, dx: amp * sign, dy: amp * 0.5 * -sign };
  }

  // 6 squash-stretch around a contact frame. Never on text.
  function squash(f, contact) {
    const d = f - contact;
    if (d < -2 || d > 3) return { sx: 1, sy: 1 };
    if (d < 0) return { sx: 0.92, sy: 1.10 };
    if (d === 0) return { sx: 1.12, sy: 0.88 };
    const t = easeOut(d / 3);
    return { sx: lerp(1.12, 1, t), sy: lerp(0.88, 1, t) };
  }

  // 7 blink: 2 f closing, 1 closed, 1 opening; gap 90-150 f, different per character
  function blink(f, seed) {
    const r = rng(seed); let at = Math.floor(30 + r() * 60);
    while (at + 4 < f) at += 90 + Math.floor(r() * 60);
    const d = f - at;
    if (d < 0 || d > 3) return 1;
    return [0.5, 0.1, 0.1, 0.6][d];
  }

  // 8 idle: 1 px breathing on a 60 f wave, +-0.5 degree on a 90 f wave
  const idle = (f, seed = 0) => ({
    dy: Math.sin((f + seed * 17) / 60 * Math.PI * 2),
    rot: Math.sin((f + seed * 29) / 90 * Math.PI * 2) * 0.5 * Math.PI / 180,
  });

  // 10 word-pop: each word 0.8 -> 1.05 -> 1.00 over 4 f, next word 3 f later
  function wordPop(f, start, i, gap = 3) {
    const d = f - (start + i * gap);
    if (d < 0) return { scale: 0.8, alpha: 0 };
    const scale = d < 2 ? lerp(0.8, 1.05, easeOut(d / 2)) : lerp(1.05, 1, easeOut((d - 2) / 2));
    return { scale, alpha: clamp(d / 2) };
  }

  // 11 whip: out over 4 f ease-in or in over 4 f ease-out, with a horizontal blur amount
  const whipOut = (f, start, width) => { const t = prog(f, start, 4); return { dx: -width * easeIn(t), blur: t > 0 && t < 1 ? 12 : 0 }; };
  const whipIn = (f, start, width) => { const t = prog(f, start, 4); return { dx: width * (1 - easeOut(t)), blur: t > 0 && t < 1 ? 12 : 0 }; };

  return { clamp, lerp, easeOut, easeIn, easeInOut, prog, rng, popIn, slide, dropBounce, punchZoom, hit, squash, blink, idle, wordPop, whipOut, whipIn };
})();
// kit.js - drawing helpers shared by every template. Also records where text lands on each
// frame so the self-check can tell if words sit under the Shorts buttons or are too small.
const K = (() => {
  const boxes = [];
  const FONT = "'Inter Display','Inter','Segoe UI Black','Arial Black',sans-serif";

  // Shorts app covers the top strip, the bottom caption/title area and the right-hand buttons.
  // On a Short the like/comment buttons only sit on the right below the middle.
  function safeZone(w, h) {
    if (h > w) return { x0: 50, y0: Math.round(h * 0.09), x1: w - 50, y1: Math.round(h * 0.78), btnX: w - 160, btnY: Math.round(h * 0.52) };
    return { x0: Math.round(w * 0.05), y0: Math.round(h * 0.05), x1: Math.round(w * 0.95), y1: Math.round(h * 0.95) };
  }

  function font(size, weight = 900, family = FONT) { return `${weight} ${Math.round(size)}px ${family}`; }

  // Fit text to a width by shrinking the size, never below min.
  function fit(ctx, str, maxW, size, weight = 900, min = 40, family = FONT, track = 0) {
    let s = size;
    for (; s > min; s -= 2) {
      ctx.font = font(s, weight, family);
      if (ctx.measureText(str).width + track * s * str.length <= maxW) break;
    }
    return s;
  }

  // Draw text and record its box (in canvas pixels, after the current transform).
  function text(ctx, str, x, y, o = {}) {
    const size = o.size || 80, weight = o.weight || 900;
    ctx.save();
    ctx.font = font(size, weight, o.family);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    if (o.track) ctx.letterSpacing = `${o.track * size}px`;
    const w = ctx.measureText(str).width;
    if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.shadowBlur ?? size * 0.08; ctx.shadowOffsetY = o.shadowY ?? size * 0.06; }
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeWidth || size * 0.14; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); ctx.shadowColor = 'transparent'; }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, x, y);
    if (!o.noRecord && (o.alpha ?? 1) > 0.5) {
      const left = ctx.textAlign === 'center' ? x - w / 2 : ctx.textAlign === 'right' ? x - w : x;
      const m = ctx.getTransform();
      const pts = [[left, y - size / 2], [left + w, y - size / 2], [left, y + size / 2], [left + w, y + size / 2]]
        .map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      boxes.push({ str, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), px: size * Math.hypot(m.c, m.d) });
    }
    ctx.restore();
    return w;
  }

  // Cached noise texture (grain, rust, yarn fuzz). Same seed, same picture.
  const cache = {};
  function grain(w, h, seed, base, spots, amount = 0.5) {
    const key = [w, h, seed, base, spots.join(), amount].join('|');
    if (cache[key]) return cache[key];
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d'), r = M.rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // big soft stains (blurred so they never look like polka dots)
    g.filter = 'blur(24px)';
    for (let i = 0; i < (w * h) / 40000 * amount + 3; i++) {
      g.globalAlpha = 0.10 + r() * 0.16; g.fillStyle = spots[Math.floor(r() * spots.length)];
      const rr = 40 + r() * 180; g.beginPath(); g.ellipse(r() * w, r() * h, rr, rr * (0.3 + r() * 0.6), r() * 3, 0, 7); g.fill();
    }
    g.filter = 'none';
    // fine pitting
    for (let i = 0; i < (w * h) / 300 * amount; i++) {
      g.globalAlpha = 0.08 + r() * 0.2; g.fillStyle = spots[Math.floor(r() * spots.length)];
      const rr = 0.8 + r() * r() * 5; g.beginPath(); g.arc(r() * w, r() * h, rr, 0, 7); g.fill();
    }
    g.filter = 'none'; g.globalAlpha = 1;
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    return (cache[key] = c);
  }

  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function rivet(ctx, x, y, r, s) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, s.highlight); g.addColorStop(0.6, s.metal); g.addColorStop(1, s.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  // Sparks burst from (x, y) starting at frame start. Deterministic.
  function sparks(ctx, f, start, x, y, seed, color, n = 26, spread = Math.PI * 2, dir = -Math.PI / 2) {
    const d = f - start; if (d < 0 || d > 22) return;
    const r = M.rng(seed);
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = dir + (r() - 0.5) * spread, sp = 18 + r() * 34, life = 10 + r() * 12;
      if (d > life) continue;
      const t = d / life, px = x + Math.cos(a) * sp * d, py = y + Math.sin(a) * sp * d + 1.2 * d * d;
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = color; ctx.lineWidth = 6 * (1 - t) + 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * sp * 0.8, py - Math.sin(a) * sp * 0.8 - 2.4 * d); ctx.stroke();
    }
    ctx.restore();
  }

  // Stand-in for real gameplay under overlays in previews only (never a real clip, no players).
  function footagePlaceholder(ctx, w, h, f) {
    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, '#5d6b73'); g.addColorStop(0.55, '#7a8466'); g.addColorStop(1, '#3d3a2f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000';
    for (let i = 0; i < 6; i++) { const x = ((i * 397 + f * 3) % (w + 400)) - 200; ctx.fillRect(x, h * 0.55, 140 + i * 30, h * 0.45); }
    ctx.restore();
  }

  return { boxes, FONT, safeZone, font, fit, text, grain, roundRect, rivet, sparks, footagePlaceholder };
})();
// crew21.js - the v21 crew (as on the website "Meet the crew"), drawn in code so it stays sharp at 1080p.
// Feet at (o.x, o.y), o.s scale (1 = ~340 px tall). Round mitts only, never hands.
// Each bot has its own topper: Wrench tool belt, Rowan glasses + bow tie, Skippy headset, Bernard camera,
// Lyra star + cable, Kestrel goggles + feathers, Radar dish.
const C21 = (() => {
  const OUT = '#0f1318';
  const BOTS = {
    wrench:  { name: 'WRENCH',  body: '#f39732', dark: '#b8661a', leg: '#6f441e', eye: '#4fd1d4', ball: '#4fd1d4' },
    rowan:   { name: 'ROWAN',   body: '#60d5d8', dark: '#2f9598', leg: '#316567', eye: '#eef3f7', ball: '#f28c1c' },
    skippy:  { name: 'SKIPPY',  body: '#f3ce5c', dark: '#c19a2a', leg: '#7b621f', eye: '#60d5d8', ball: '#e0352b' },
    bernard: { name: 'BERNARD', body: '#a588ec', dark: '#7258c0', leg: '#4c3d7a', eye: '#f4f4f4', ball: '#e0352b' },
    lyra:    { name: 'LYRA',    body: '#88d779', dark: '#56a548', leg: '#3f7037', eye: '#f4f4f4', ball: '#f2cf4a' },
    kestrel: { name: 'KESTREL', body: '#6b88bc', dark: '#435f93', leg: '#354461', eye: '#f2c94c', ball: '#f2cf4a' },
    radar:   { name: 'RADAR',   body: '#d4dae1', dark: '#9aa3ad', leg: '#585e66', eye: '#7fd16b', ball: '#cbd1d7' },
  };
  const ORDER = ['wrench', 'rowan', 'skippy', 'bernard', 'lyra', 'kestrel', 'radar'];
  const P = (ctx, fill, lw) => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); };

  function eyes(ctx, f, o, c, s) {
    const face = o.face || 'normal', b = face === 'normal' ? M.blink(f, o.seed || 1) : 1;
    ctx.save(); ctx.fillStyle = c.eye; ctx.strokeStyle = c.eye; ctx.lineCap = 'round';
    ctx.shadowColor = c.eye; ctx.shadowBlur = 18 * s;
    for (const side of [-1, 1]) {
      const x = side * 34 * s, y = -186 * s;
      ctx.lineWidth = 9 * s;
      if (face === 'happy') { ctx.beginPath(); ctx.arc(x, y + 10 * s, 16 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      else if (face === 'tired') { ctx.beginPath(); ctx.moveTo(x - 15 * s, y + 2 * s); ctx.lineTo(x + 15 * s, y + 2 * s); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + 2 * s, 12 * s, 0, Math.PI); ctx.fill(); }
      else if (face === 'wide') { ctx.beginPath(); ctx.arc(x, y, 21 * s, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x + 5 * s, y - 4 * s, 7 * s, 0, 7); ctx.fill(); ctx.fillStyle = c.eye; }
      else if (face === 'squint') { ctx.beginPath(); ctx.moveTo(x - 15 * s, y); ctx.lineTo(x + 15 * s, y); ctx.stroke(); }
      else { K.roundRect(ctx, x - 12 * s, y - 22 * s * b, 24 * s, 44 * s * b, 12 * s); ctx.fill(); }
    }
    // mouth
    ctx.lineWidth = 6 * s; ctx.beginPath();
    if (face === 'wide') ctx.ellipse(0, -152 * s, 9 * s, 11 * s, 0, 0, 7), ctx.stroke();
    else ctx.arc(0, -160 * s, 11 * s, Math.PI * 0.15, Math.PI * 0.85), ctx.stroke();
    ctx.restore();
    // Rowan's glasses / Kestrel's goggles sit over the eyes
    if (o.who === 'rowan') { ctx.strokeStyle = '#f4f7f9'; ctx.lineWidth = 8 * s; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * 34 * s, -186 * s, 30 * s, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-6 * s, -190 * s); ctx.lineTo(6 * s, -190 * s); ctx.stroke(); }
    if (o.who === 'kestrel') { ctx.strokeStyle = '#43506a'; ctx.lineWidth = 9 * s; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * 34 * s, -186 * s, 31 * s, 0, 7); ctx.stroke(); } }
  }

  function topper(ctx, f, o, c, s, top) {
    const w = o.who, wob = Math.sin(f / 9 + (o.seed || 1)) * 0.06 + (o.antWob || 0);
    // feathers go behind the antenna
    if (w === 'kestrel') {
      [[-38, -0.45, '#6b88bc'], [-8, -0.1, '#f2c94c'], [22, 0.25, '#6b88bc']].forEach(([x, r, col], i) => {
        ctx.save(); ctx.translate(x * s, top + 4 * s); ctx.rotate(r + Math.sin(f / 7 + i) * 0.05);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-16 * s, -40 * s, 0, -78 * s); ctx.quadraticCurveTo(16 * s, -40 * s, 0, 0); P(ctx, col, 6 * s); ctx.restore();
      });
    }
    // antenna
    const ax = w === 'kestrel' ? 46 * s : 0, len = w === 'radar' ? 40 * s : 42 * s;
    ctx.save(); ctx.translate(ax, top); ctx.rotate(wob);
    ctx.strokeStyle = OUT; ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.stroke();
    const by = -len - 12 * s;
    if (w === 'lyra') { // star
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = (i % 2 ? 8 : 18) * s, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, by + Math.sin(a) * r); } ctx.closePath(); P(ctx, '#f2cf4a', 5 * s);
    } else if (w === 'bernard') { // film reel
      ctx.beginPath(); ctx.arc(0, by, 15 * s, 0, 7); P(ctx, '#e0352b', 5 * s);
      ctx.fillStyle = OUT; for (let i = 0; i < 5; i++) { const a = f / 12 + i * Math.PI * 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * 7 * s, by + Math.sin(a) * 7 * s, 3 * s, 0, 7); ctx.fill(); }
    } else if (w === 'radar') { // dish + signal arcs
      ctx.beginPath(); ctx.arc(0, by - 12 * s, 30 * s, 0, 7); P(ctx, '#e9edf1', 6 * s);
      ctx.beginPath(); ctx.arc(0, by - 12 * s, 19 * s, 0, 7); ctx.strokeStyle = '#b8c0c8'; ctx.lineWidth = 4 * s; ctx.stroke();
      const sweep = f / 10; ctx.strokeStyle = '#3e9b45'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(0, by - 12 * s); ctx.lineTo(Math.cos(sweep) * 14 * s, by - 12 * s + Math.sin(sweep) * 14 * s); ctx.stroke();
      ctx.fillStyle = '#7fd16b'; ctx.beginPath(); ctx.arc(Math.cos(sweep) * 14 * s, by - 12 * s + Math.sin(sweep) * 14 * s, 5 * s, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) { const q = ((f / 40 + i / 3) % 1); ctx.globalAlpha = 1 - q; ctx.strokeStyle = '#3e9b45'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(0, by - 12 * s, (40 + q * 40) * s, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else {
      ctx.save(); ctx.shadowColor = c.ball; ctx.shadowBlur = (w === 'skippy' ? 20 * (0.5 + 0.5 * Math.sin(f / 5)) : 8) * s;
      ctx.beginPath(); ctx.arc(0, by, 13 * s, 0, 7); P(ctx, c.ball, 5 * s); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-4 * s, by - 4 * s, 4 * s, 0, 7); ctx.fill();
    }
    ctx.restore();
    if (w === 'skippy') { // headset band + ear cups + mic boom
      ctx.strokeStyle = OUT; ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.arc(0, top + 70 * s, 118 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.strokeStyle = '#3a424b'; ctx.lineWidth = 5 * s; ctx.stroke();
      for (const side of [-1, 1]) { K.roundRect(ctx, side * 112 * s - 14 * s, top + 40 * s, 28 * s, 54 * s, 10 * s); P(ctx, '#2a3038', 6 * s); ctx.fillStyle = '#e0352b'; ctx.beginPath(); ctx.arc(side * 112 * s, top + 60 * s, 6 * s, 0, 7); ctx.fill(); }
      ctx.strokeStyle = OUT; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(-112 * s, top + 90 * s); ctx.quadraticCurveTo(-96 * s, top + 118 * s, -52 * s, top + 118 * s); ctx.stroke();
      ctx.beginPath(); ctx.arc(-48 * s, top + 118 * s, 8 * s, 0, 7); P(ctx, '#2a3038', 4 * s);
    }
    if (w === 'bernard') { // little camera on the head, red tally light blinks
      ctx.save(); ctx.translate(70 * s, top - 14 * s); ctx.rotate(0.12 + Math.sin(f / 20) * 0.05);
      K.roundRect(ctx, -26 * s, -16 * s, 60 * s, 30 * s, 6 * s); P(ctx, '#2a3038', 5 * s);
      ctx.beginPath(); ctx.arc(38 * s, 0, 12 * s, 0, 7); P(ctx, '#4fd1d4', 5 * s);
      ctx.fillStyle = f % 30 < 18 ? '#ff3b30' : '#5a1a18'; ctx.beginPath(); ctx.arc(-14 * s, -4 * s, 5 * s, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function bot(ctx, f, o) {
    const c = BOTS[o.who], s = o.s || 1, seed = o.seed || 1, id = M.idle(f, seed);
    const sq = o.squash || { sx: 1, sy: 1 };
    ctx.save(); ctx.translate(o.x, o.y);
    if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 4 * s, 105 * s * (1 - (o.lift || 0) / 400), 14 * s, 0, 0, 7); ctx.fill(); }
    ctx.translate(0, -(o.lift || 0) + id.dy * 2 * s); ctx.rotate((o.lean || 0) + id.rot); ctx.scale(sq.sx, sq.sy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // legs
    for (const side of [-1, 1]) {
      const kick = (o.kick || 0) * side;
      ctx.save(); ctx.translate(side * 34 * s, -72 * s); ctx.rotate(kick);
      K.roundRect(ctx, -12 * s, 0, 24 * s, 62 * s, 10 * s); P(ctx, c.leg, 7 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(0, 26 * s, 5 * s, 0, 7); ctx.fill();
      K.roundRect(ctx, -22 * s, 54 * s, 44 * s, 18 * s, 9 * s); P(ctx, OUT, 0.1);
      ctx.restore();
    }
    const top = -262 * s, bw = 214 * s, bh = 196 * s, bx = -bw / 2, byy = -258 * s;
    // Lyra's cable loops behind on the left
    if (o.who === 'lyra') { ctx.strokeStyle = OUT; ctx.lineWidth = 11 * s; ctx.beginPath(); ctx.moveTo(-60 * s, top + 10 * s); ctx.bezierCurveTo(-170 * s, top - 10 * s, -160 * s, -110 * s, -112 * s, -96 * s); ctx.stroke(); ctx.strokeStyle = '#f2cf4a'; ctx.lineWidth = 5 * s; ctx.stroke(); }
    // body with a darker lower half
    const g = ctx.createLinearGradient(0, byy, 0, byy + bh); g.addColorStop(0, c.body); g.addColorStop(0.62, c.body); g.addColorStop(0.63, c.dark); g.addColorStop(1, c.dark);
    K.roundRect(ctx, bx, byy, bw, bh, 40 * s); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 8 * s; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; K.roundRect(ctx, bx + 18 * s, byy + 10 * s, bw * 0.45, 10 * s, 5 * s); ctx.fill();
    // screen
    const sx = -80 * s, sy = byy + 14 * s, sw = 160 * s, sh = 96 * s;
    K.roundRect(ctx, sx, sy, sw, sh, 22 * s); P(ctx, '#151b21', 6 * s);
    ctx.save(); K.roundRect(ctx, sx, sy, sw, sh, 22 * s); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(sx + 30 * s, sy); ctx.lineTo(sx + 70 * s, sy); ctx.lineTo(sx + 30 * s, sy + sh); ctx.lineTo(sx - 10 * s, sy + sh); ctx.fill();
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#000'; for (let y = sy; y < sy + sh; y += 5 * s) ctx.fillRect(sx, y, sw, 2 * s); ctx.globalAlpha = 1;
    ctx.restore();
    // arms + mitts
    for (const side of [-1, 1]) {
      const up = side < 0 ? (o.armL ?? o.arms ?? 0) : (o.armR ?? o.arms ?? 0); // 0 down, 1 straight up
      const ang = side * (0.42 + up * 2.5) + (o.swing ? Math.sin(f / 6 + side) * 0.15 * o.swing : 0);
      ctx.save(); ctx.translate(side * (bw / 2 - 2 * s), -196 * s); ctx.rotate(-ang);
      ctx.strokeStyle = OUT; ctx.lineWidth = 20 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 92 * s); ctx.stroke();
      ctx.strokeStyle = c.dark; ctx.lineWidth = 9 * s; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 100 * s, 21 * s, 0, 7); P(ctx, c.body, 7 * s);
      ctx.restore();
    }
    eyes(ctx, f, o, c, s);
    // status lights + vents
    ['#e0352b', '#f2cf4a', '#7fd16b'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-92 * s, (-122 + i * 14) * s, 4.5 * s, 0, 7); ctx.fill(); });
    ctx.strokeStyle = 'rgba(15,19,24,0.35)'; ctx.lineWidth = 3 * s; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(80 * s, (-124 + i * 9) * s); ctx.lineTo(96 * s, (-124 + i * 9) * s); ctx.stroke(); }
    // Rowan bow tie, Wrench tool belt + spanner
    if (o.who === 'rowan') { ctx.save(); ctx.translate(0, -146 * s); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20 * s, -10 * s); ctx.lineTo(-20 * s, 10 * s); ctx.closePath(); P(ctx, '#f28c1c', 4 * s); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20 * s, -10 * s); ctx.lineTo(20 * s, 10 * s); ctx.closePath(); P(ctx, '#f28c1c', 4 * s); ctx.beginPath(); ctx.arc(0, 0, 5 * s, 0, 7); P(ctx, '#c4650f', 3 * s); ctx.restore(); }
    if (o.who === 'wrench') {
      ctx.fillStyle = '#5b3818'; ctx.fillRect(bx + 4 * s, -88 * s, bw - 8 * s, 14 * s); ctx.fillStyle = '#f2cf4a'; ctx.fillRect(-8 * s, -90 * s, 16 * s, 18 * s);
      ctx.save(); ctx.translate(78 * s, -70 * s); ctx.rotate(0.35 + Math.sin(f / 8) * 0.08); ctx.strokeStyle = OUT; ctx.lineWidth = 10 * s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46 * s); ctx.stroke(); ctx.strokeStyle = '#d6dce2'; ctx.lineWidth = 5 * s; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 52 * s, 10 * s, 0.6, Math.PI * 2 - 0.6 + Math.PI); ctx.strokeStyle = '#d6dce2'; ctx.lineWidth = 6 * s; ctx.stroke(); ctx.restore();
    }
    // name plate
    const ns = K.fit(ctx, c.name, 150 * s, 34 * s, 900, 14 * s);
    K.text(ctx, c.name, 4 * s, -104 * s, { size: ns, color: '#fff', stroke: OUT, strokeWidth: ns * 0.24, noRecord: true });
    topper(ctx, f, o, c, s, byy);
    if (o.star != null) { const d = f - o.star; if (d >= 0 && d < 36) { const p = M.popIn(f, o.star); ctx.save(); ctx.translate(90 * s, byy - 70 * s); ctx.rotate(d * 0.1); ctx.scale(p.scale * s, p.scale * s); ctx.globalAlpha = 1 - Math.max(0, (d - 26) / 10); ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 32, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); P(ctx, '#f2cf4a', 5); ctx.restore(); } }
    ctx.restore();
  }
  return { bot, BOTS, ORDER, OUT };
})();
// toys.js - six tiny live tiles for the homepage Toy Box. Each scene is drawn in code with the v21 crew.
(() => {
  const OUT = '#0f1318';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };

  // Central-time day number (Derby track #1 = Nov 12 2026), advent door if in Dec 1-24
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const day = Date.UTC(+p.year, +p.month - 1, +p.day), n = Math.max(1, Math.round((day - Date.UTC(2026, 10, 12)) / 864e5) + 1);
    document.getElementById('daily').textContent = 'Today: Derby track #' + n;
    if (document.getElementById('advent') && +p.month === 12 && +p.day <= 24) document.getElementById('advent').textContent = 'DOOR ' + p.day + ' OPEN';
  } catch (e) {}

  const scenes = {
    couch(c, w, h, t, f) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1d1730'); g.addColorStop(1, '#2b2142'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      const tw = w * 0.5, th = tw * 0.56, tx = (w - tw) / 2, ty = h * 0.06;
      c.fillStyle = '#6b4526'; rr(c, tx - 8, ty - 8, tw + 16, th + 22, 10); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.1);
      c.fillStyle = `rgba(96,213,216,${0.55 * fl + 0.2})`; rr(c, tx, ty, tw, th, 6); c.fill();
      c.fillStyle = '#e0352b'; rr(c, tx + tw / 2 - 14, ty + th / 2 - 10, 28, 20, 5); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(tx + tw / 2 - 4, ty + th / 2 - 6); c.lineTo(tx + tw / 2 + 7, ty + th / 2); c.lineTo(tx + tw / 2 - 4, ty + th / 2 + 6); c.fill();
      const s = h / 820, ct = h * 0.8;
      c.fillStyle = '#8c3a3a'; rr(c, w * 0.12, ct - 120 * s, w * 0.76, 130 * s, 20 * s); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      ['skippy', 'wrench', 'lyra'].forEach((who, i) => {
        const hop = who === 'skippy' && (t % 4) < 0.4 ? Math.sin((t % 4) / 0.4 * Math.PI) * 18 * s : 0;
        C21.bot(c, f, { who, x: w * (0.33 + i * 0.17), y: ct + 60 * s, s, seed: i + 2, noShadow: true, lift: hop, arms: who === 'wrench' ? 0.3 : 0.05, face: who === 'skippy' && (t % 4) < 1.2 ? 'squint' : 'normal' });
      });
      c.fillStyle = '#a8423a'; rr(c, w * 0.12, ct, w * 0.76, h - ct, 16 * s); c.fill(); c.stroke();
      const k = (t * 0.8) % 2; if (k < 0.7) { c.fillStyle = '#fff6dc'; c.beginPath(); c.arc(w * 0.52, ct - 60 * s - Math.sin(k / 0.7 * Math.PI) * 110 * s, 8 * s + 2, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); }
    },
    derby(c, w, h, t, f) {
      c.fillStyle = '#0a1230'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f5a37'; c.fillRect(0, h * 0.42, w, h * 0.58);
      c.strokeStyle = 'rgba(255,246,220,.35)'; c.setLineDash([10, 10]); c.lineWidth = 2;
      for (const y of [0.62, 0.82]) { c.beginPath(); c.moveTo(0, h * y); c.lineTo(w, h * y); c.stroke(); }
      c.setLineDash([]);
      for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#f2cf4a' : '#e0352b'; c.beginPath(); c.arc((i + 0.5) * w / 9, h * 0.08 + Math.sin(i) * 4, 4, 0, 7); c.fill(); }
      const s = h / 700;
      [['rowan', 0.55, 70], ['wrench', 0.75, 110], ['skippy', 0.95, 85]].forEach(([who, ly, sp], i) => {
        const span = w + 260 * s, x = ((t * sp * (h / 250) + i * 140) % span) - 130 * s, y = h * ly;
        c.save(); c.translate(x - 110 * s, y - 160 * s); c.rotate(t * 8 + i);
        c.strokeStyle = OUT; c.lineWidth = 3; c.fillStyle = '#f2cf4a';
        for (const k of [-1, 1]) { c.beginPath(); c.ellipse(k * 16 * s, 0, 16 * s, 9 * s, 0, 0, 7); c.fill(); c.stroke(); }
        c.restore();
        C21.bot(c, f, { who, x, y, s, seed: i + 4, noShadow: true, kick: Math.sin(t * 14 + i) * 0.4, swing: 1, face: who === 'wrench' ? 'wide' : 'normal' });
      });
    },
    market(c, w, h, t, f) {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1230'); g.addColorStop(1, '#1b2a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const x = (i * 97.3 + Math.sin(t + i) * 10) % w, y = ((i * 53.7) + t * 22 * (1 + i % 3)) % h; c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x, y, 1.5 + (i % 3), 0, 7); c.fill(); }
      c.fillStyle = '#e8edf6'; c.fillRect(0, h * 0.86, w, h * 0.14);
      const tx = w * 0.32, base = h * 0.86, th = h * 0.7;
      c.fillStyle = '#5a3a1e'; c.fillRect(tx - 8, base - 22, 16, 22);
      for (let k = 0; k < 3; k++) { const y0 = base - 18 - k * th * 0.26, ww = w * (0.19 - k * 0.045); c.beginPath(); c.moveTo(tx - ww, y0); c.lineTo(tx, y0 - th * 0.42); c.lineTo(tx + ww, y0); c.closePath(); c.fillStyle = '#2f8a4c'; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); }
      for (let i = 0; i < 14; i++) { const on = (Math.floor(t * 3) + i) % 3 === 0; const a = i * 2.4, r = (i % 5) / 5; c.fillStyle = on ? ['#f2cf4a', '#e0352b', '#60d5d8'][i % 3] : '#2a3a2a'; c.beginPath(); c.arc(tx + Math.sin(a) * w * 0.12 * (0.3 + r), base - 30 - (i / 14) * th * 0.75, 4.5, 0, 7); c.fill(); }
      c.fillStyle = '#f2cf4a'; c.beginPath(); for (let i = 0; i < 10; i++) { const rad = i % 2 ? 6 : 14, a = -Math.PI / 2 + i * Math.PI / 5 + t; c.lineTo(tx + Math.cos(a) * rad, base - th * 0.98 + Math.sin(a) * rad); } c.fill();
      const s = h / 620;
      C21.bot(c, f, { who: 'wrench', x: w * 0.68, y: base + 10 * s, s, seed: 5, noShadow: true, arms: 0.9 + Math.sin(t * 3) * 0.08, face: 'happy', swing: 0.5 });
    },
    puzzle(c, w, h, t, f) {
      c.fillStyle = '#16302f'; c.fillRect(0, 0, w, h);
      const off = scenes._off || (scenes._off = document.createElement('canvas')); if (off.width !== Math.round(w) || off.height !== Math.round(h)) { off.width = Math.round(w); off.height = Math.round(h); } const o = off.getContext('2d'); o.clearRect(0, 0, w, h);
      o.fillStyle = '#60d5d8'; o.fillRect(0, 0, w, h); o.fillStyle = '#2f9598'; o.fillRect(0, h * 0.7, w, h * 0.3);
      C21.bot(o, f, { who: 'rowan', x: w / 2, y: h * 0.96, s: h / 380, seed: 3, noShadow: true, arms: 0.5, face: 'happy' });
      const cols = 4, rows = 3, pw = w / cols, ph = h / rows, cyc = t % 5;
      const k = cyc < 1.6 ? 1 - Math.min(1, cyc / 1.6) : cyc < 3.8 ? 0 : (cyc - 3.8) / 1.2;
      const e = k * k * (3 - 2 * k);
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        const i = r * cols + q, ang = i * 2.3, dx = Math.cos(ang) * w * 0.35 * e, dy = Math.sin(ang) * h * 0.4 * e;
        c.save(); c.translate(q * pw + dx, r * ph + dy); c.rotate(e * (i % 2 ? 0.5 : -0.4));
        c.drawImage(off, q * pw, r * ph, pw, ph, 0, 0, pw, ph); c.strokeStyle = OUT; c.lineWidth = 2; c.strokeRect(0, 0, pw, ph); c.restore();
      }
    },
    quiz(c, w, h, t, f) {
      c.fillStyle = '#231c33'; c.fillRect(0, 0, w, h);
      const order = C21.ORDER, n = order.length, s = Math.min(h / 480, w / (n * 205)), cur = Math.floor(t / 0.7) % n;
      order.forEach((who, i) => {
        const x = w * (i + 0.5) / n, y = h * 0.88, ph = (t % 0.7) / 0.7, lift = i === cur ? Math.sin(ph * Math.PI) * 50 * s : 0;
        C21.bot(c, f, { who, x, y, s, seed: i + 1, noShadow: true, lift, arms: i === cur ? 0.9 : 0.05, face: i === cur ? 'happy' : 'normal' });
      });
      const bx = w * (cur + 0.5) / n, by = h * 0.88 - 300 * s - 30;
      c.fillStyle = '#fff6dc'; rr(c, bx - 22, by - 22, 44, 40, 12); c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = '#14181d'; c.font = '400 24px Bungee, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', bx, by - 1);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '500 12px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.fillText('Q' + (1 + Math.floor(t / 2.8) % 8) + ' / 8', 12, 18);
    },
    tapes(c, w, h, t, f) {
      c.fillStyle = '#2a2018'; c.fillRect(0, 0, w, h);
      const cx = w / 2, by = h * 0.86, bw = w * 0.36;
      // open book
      c.fillStyle = '#f4ead2'; c.lineWidth = 3; c.strokeStyle = OUT;
      c.beginPath(); c.moveTo(cx, by); c.lineTo(cx - bw, by - h * 0.08); c.lineTo(cx - bw, by - h * 0.02 + 10); c.lineTo(cx, by + 10); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(cx, by); c.lineTo(cx + bw, by - h * 0.08); c.lineTo(cx + bw, by - h * 0.02 + 10); c.lineTo(cx, by + 10); c.closePath(); c.fill(); c.stroke();
      const cyc = t % 4, k = cyc < 1 ? cyc : cyc < 3.2 ? 1 : 1 - (cyc - 3.2) / 0.8, e = k * k * (3 - 2 * k);
      c.save(); c.translate(cx, by); c.scale(1, Math.max(0.02, e)); c.translate(-cx, -by);
      C21.bot(c, f, { who: 'bernard', x: cx, y: by - 4, s: h / 520, seed: 6, noShadow: true, arms: 0.7 * e, face: 'happy' });
      c.restore();
      c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
      const ty = (t * 60) % (h + 40) - 20; c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, ty, w, 6);
      c.fillStyle = '#f4ead2'; c.font = '500 13px "IBM Plex Mono", monospace'; c.textAlign = 'right'; c.textBaseline = 'top';
      c.fillText((Math.floor(t * 2) % 2 ? '▶ PLAY' : '      ') + '  JUN 14 1987', w - 12, 12);
    },
  };

  scenes.peek=(c,w,h,t,f)=>C21.bot(c,f,{who:'wrench',x:w/2,y:90*h/40,s:.3*h/40,noShadow:true,face:'normal'});document.getElementById('crew-sticker-peek')?.addEventListener('click',()=>window.UBStickers.give('h1'));
  const tiles = [...document.querySelectorAll('canvas[data-scene]')].map(cv => ({ cv, ctx: cv.getContext('2d'), scene: scenes[cv.dataset.scene], on: true, w: 0, h: 0 }));
  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    for (const T of tiles) { const r = T.cv.getBoundingClientRect(); T.w = r.width; T.h = r.height; T.cv.width = Math.round(r.width * dpr); T.cv.height = Math.round(r.height * dpr); T.dpr = dpr; }
  }
  function draw(T, t) { const c = T.ctx; c.setTransform(T.dpr, 0, 0, T.dpr, 0, 0); c.clearRect(0, 0, T.w, T.h); c.save(); T.scene(c, T.w, T.h, t, Math.floor(t * 30)); c.restore(); }
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(e => { const T = tiles.find(x => x.cv === e.target); if (T) T.on = e.isIntersecting; })); tiles.forEach(T => io.observe(T.cv)); }
  addEventListener('resize', () => { size(); if (reduce) tiles.forEach(T => draw(T, 2.2)); });
  function boot() {
    size();
    if (reduce) { tiles.forEach(T => draw(T, 2.2)); return; }
    const t0 = performance.now();
    (function loop(now) { const t = (now - t0) / 1000 + 2.2; for (const T of tiles) if (T.on) draw(T, t); requestAnimationFrame(loop); })(t0);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot, boot);
})();

})();
