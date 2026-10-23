// 騎手目線の疑似3D描画
(function () {
  'use strict';
  const OFF = 120; // 負の距離（ゲート後方）用オフセット
  let C = null; // 現在のコース
  let TX, TY, TH;

  // ---- コースの世界座標（内ラチ基準, 1m 刻み） ----
  // 左回りは左へ、右回りは右へ曲がる。w（内ラチからの距離）は常にコースの外側へ。
  function setCourse(course) {
    if (C === course) return;
    C = course;
    const n = Math.ceil(course.length) + OFF + 420;
    TX = new Float64Array(n);
    TY = new Float64Array(n);
    TH = new Float64Array(n);
    let x = 0, y = 0, th = 0;
    for (let i = 0; i < n; i++) {
      const s = i - OFF;
      TX[i] = x; TY[i] = y; TH[i] = th;
      const k = (Sim.curveOverlap(course, s, s + 1) * course.dir) / course.radius;
      const mid = th + k / 2;
      x += Math.cos(mid);
      y += Math.sin(mid);
      th += k;
    }
    mapBounds = null;
  }

  function trackAt(s) {
    let p = s + OFF;
    if (p < 0) p = 0;
    if (p > TX.length - 2) p = TX.length - 2;
    const i = Math.floor(p), f = p - i;
    return {
      x: TX[i] + (TX[i + 1] - TX[i]) * f,
      y: TY[i] + (TY[i + 1] - TY[i]) * f,
      th: TH[i] + (TH[i + 1] - TH[i]) * f,
    };
  }
  // s, w(内ラチから外への距離) → 世界座標
  function worldAt(s, w) {
    const t = trackAt(s);
    const d = C.dir;
    return { x: t.x + d * w * Math.sin(t.th), y: t.y - d * w * Math.cos(t.th), th: t.th };
  }

  // 枠の色（帽子）
  const FRAME_COLORS = ['#ffffff', '#ffffff', '#222222', '#e0262b', '#1f5fd1', '#f2d22e', '#2c9a48', '#f08a1c', '#f59ac0'];
  const COATS = ['#7a4524', '#55301a', '#a5532a', '#2a1c14', '#9e8f84', '#8a4b22'];
  const SILK_COLORS = ['#c8102e', '#0033a0', '#ffd100', '#00843d', '#7f3f98', '#ff6a13', '#ffffff', '#111111', '#e10098', '#00a3e0', '#8b5a2b', '#a4d65e'];

  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    return (n ^ (n >>> 15)) >>> 0;
  }
  function horseLook(h, seed) {
    const r = hash(h.num * 7919 + seed);
    return {
      coat: COATS[r % COATS.length],
      silk1: h.isPlayer ? '#0b3d91' : SILK_COLORS[(r >>> 4) % SILK_COLORS.length],
      silk2: h.isPlayer ? '#ffd23f' : SILK_COLORS[(r >>> 9) % SILK_COLORS.length],
      pattern: h.isPlayer ? 1 : (r >>> 14) % 4,
      cap: FRAME_COLORS[h.frame],
      phase: ((r >>> 18) % 100) / 100,
    };
  }

  // 背景（遠景）を一度だけ生成
  let bgCanvas = null, bgKey = '';
  function buildBackground(period, hgt) {
    const key = period + 'x' + hgt;
    if (bgKey === key) return;
    bgKey = key;
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = period;
    bgCanvas.height = hgt;
    const g = bgCanvas.getContext('2d');
    const rnd = Sim.mulberry32(42);
    // 山並み
    g.fillStyle = '#9fb4c7';
    g.beginPath();
    g.moveTo(0, hgt);
    let y = hgt * 0.45;
    for (let x = 0; x <= period; x += 8) {
      y += (rnd() - 0.5) * hgt * 0.06;
      y = Math.min(hgt * 0.7, Math.max(hgt * 0.2, y));
      const wrapFix = x > period - 200 ? (hgt * 0.45 - y) * ((x - (period - 200)) / 200) : 0;
      g.lineTo(x, y + wrapFix);
    }
    g.lineTo(period, hgt);
    g.fill();
    // ビル群（府中の街並み）
    for (let i = 0; i < 70; i++) {
      const bx = rnd() * period, bw = 10 + rnd() * 30, bh = hgt * (0.12 + rnd() * 0.3);
      g.fillStyle = rnd() < 0.5 ? '#b9c3cc' : '#a8b2bb';
      g.fillRect(bx, hgt - bh, bw, bh);
    }
    // 木立
    g.fillStyle = '#3d6b3a';
    for (let x = 0; x < period; x += 6) {
      const th = hgt * (0.1 + 0.12 * Math.abs(Math.sin(x * 0.013) + Math.sin(x * 0.047) * 0.5) + rnd() * 0.05);
      g.beginPath();
      g.arc(x, hgt - th * 0.5, th * 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#2f5a2e';
    g.fillRect(0, hgt - hgt * 0.08, period, hgt * 0.08);
  }

  function inHome(s) {
    return Sim.inHome(C, s);
  }

  // 空の色（昼・夕暮れ・ナイター）
  const SKIES = {
    day: { top: '#3f86d8', bottom: '#cfe6f7', cloud: 'rgba(255,255,255,0.85)', tint: null },
    dusk: { top: '#4d5f9e', bottom: '#f6c48a', cloud: 'rgba(255,214,170,0.75)', tint: 'rgba(255,140,60,0.10)' },
    night: { top: '#050a1f', bottom: '#1f2b52', cloud: 'rgba(120,130,170,0.25)', tint: 'rgba(5,10,40,0.38)' },
  };

  // ---- メイン描画 ----
  // st: { race, cam:{s,x,h,yaw,roll}, rider:{...}, gate, time }
  function draw(ctx, W, H, st) {
    const cam = st.cam;
    const F = Math.max(W * 0.62, H * 0.62);
    const horizon = H * (W < H ? 0.4 : 0.44) + (cam.pitch || 0) * H;
    const cx = W / 2;
    const ct = worldAt(cam.s, cam.x);
    const thc = ct.th - (cam.yaw || 0);
    const cos = Math.cos(thc), sin = Math.sin(thc);
    const camH = cam.h;

    function project(px, py, h) {
      const dx = px - ct.x, dy = py - ct.y;
      const fwd = dx * cos + dy * sin;
      const lat = dx * sin - dy * cos;
      return { fwd, sx: cx + (lat / fwd) * F, sy: horizon + ((camH - h) / fwd) * F, k: F / fwd };
    }
    function projSW(s, w, h) {
      const p = worldAt(s, w);
      return project(p.x, p.y, h || 0);
    }

    ctx.save();
    if (cam.roll) {
      ctx.translate(cx, H * 0.7);
      ctx.rotate(cam.roll);
      ctx.translate(-cx, -H * 0.7);
    }

    // 空
    const SK = SKIES[st.sky] || SKIES.day;
    const sky = ctx.createLinearGradient(0, horizon - H * 0.6, 0, horizon);
    sky.addColorStop(0, SK.top);
    sky.addColorStop(1, SK.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(-W, -H, W * 3, horizon + H + 2);
    // 雲
    const period = Math.round(Math.PI * 2 * F);
    const scroll = ((-thc * F) % period + period) % period;
    ctx.fillStyle = SK.cloud;
    for (let i = 0; i < 9; i++) {
      const bx = ((i * period) / 9 + scroll * 0.98) % period - period / 2 + cx;
      for (const k of [0, period, -period]) {
        const x = bx + k;
        if (x < -300 || x > W + 300) continue;
        const y = horizon - H * (0.22 + (i % 3) * 0.08);
        ctx.beginPath();
        ctx.ellipse(x, y, 70 + (i % 4) * 25, 16, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 40, y - 10, 45, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 遠景
    const bgH = Math.round(H * 0.16);
    buildBackground(period, bgH);
    for (let x = scroll - period; x < W + period; x += period) {
      ctx.drawImage(bgCanvas, x - period / 2 + cx - Math.floor((cx) / period) * period, horizon - bgH + 1);
    }
    // 地面の基本色
    ctx.fillStyle = '#4f8a3c';
    ctx.fillRect(-W, horizon, W * 3, H * 2);

    // セグメント（遠い順に描くため、全要素を奥行きで並べ替える）
    const DRAW = 260;
    const back = Math.abs(cam.yaw || 0) > 0.2 ? 140 : 0;
    const segs = [];
    // 区切りは世界座標の格子に固定（カメラが動いても模様がちらつかない）
    let s = Math.ceil((cam.s + 0.6 - back) / 1.5) * 1.5;
    while (s < cam.s + DRAW) {
      segs.push(s);
      const d = Math.abs(s - cam.s);
      const step = d < 30 ? 1.5 : d < 100 ? 3 : 6;
      s = (Math.floor(s / step + 1e-6) + 1) * step;
    }
    const WS = [-70, -26, -9, -0.8, C.width + 1.5, 40];
    const rows = segs.map((sv) => WS.map((w) => projSW(sv, w, 0)));
    const ops = [];
    const NEAR = 0.3;
    const ok4 = (a, b, c, d) => a.fwd > NEAR && b.fwd > NEAR && c.fwd > NEAR && d.fwd > NEAR;
    for (let i = segs.length - 1; i > 0; i--) {
      const sFar = segs[i], sNear = segs[i - 1];
      const far = rows[i], near = rows[i - 1];
      const band = Math.floor((sFar + sNear) / 12) % 2 === 0;
      const depth = Math.max(projSW(sFar, 10, 0).fwd, projSW(sNear, 10, 0).fwd);
      if (depth > NEAR) {
        ops.push({ d: depth, f: () => {
          // ダートのレースは本馬場が砂、外側が芝コース。芝のレースは内側にダートコース
          const cols = C.surface === 'dirt'
            ? [band ? '#4c8a3a' : '#478437', band ? '#4c8a3a' : '#478437', band ? '#5b9a42' : '#55943e', band ? '#b08a5e' : '#a88257', band ? '#3f9b3a' : '#378f33']
            : [band ? '#4c8a3a' : '#478437', band ? '#9b7650' : '#94704a', band ? '#5b9a42' : '#55943e', band ? '#3f9b3a' : '#378f33', band ? '#4d8d3e' : '#48873a'];
          for (let j = 0; j < 5; j++) {
            if (ok4(far[j], far[j + 1], near[j + 1], near[j])) quad(ctx, far[j], far[j + 1], near[j + 1], near[j], cols[j]);
          }
          // 決勝線
          if (sFar >= C.length && sNear < C.length) {
            const a = projSW(C.length, -0.8, 0), b = projSW(C.length, C.width + 1.5, 0);
            const a2 = projSW(C.length + 0.4, -0.8, 0), b2 = projSW(C.length + 0.4, C.width + 1.5, 0);
            if (ok4(a, b, a2, b2)) quad(ctx, a2, b2, b, a, 'rgba(255,255,255,0.85)');
          }
        } });
      }
      for (const w of [-0.8, C.width + 1.5]) {
        const dd = projSW((sFar + sNear) / 2, w, 0).fwd;
        if (dd > NEAR) ops.push({ d: dd - 0.01, f: () => rail(ctx, projSW, sFar, sNear, w) });
      }
      // ハロン棒・ゴール板
      for (let m = 200; m < C.length; m += 200) {
        const ps = C.length - m;
        if (ps < sFar && ps >= sNear) ops.push({ d: projSW(ps, -1.6, 0).fwd, f: () => furlongPost(ctx, projSW, ps, m) });
      }
      if (C.length < sFar && C.length >= sNear) ops.push({ d: projSW(C.length, -2.2, 0).fwd, f: () => goalPost(ctx, projSW, C.length) });
      // スタンド・木
      if (inHome(sNear) && inHome(sFar)) {
        // スタンドは 6m 格子で別に描く
      } else if (Math.floor(sNear / 25) !== Math.floor(sFar / 25)) {
        const ts = Math.floor(sFar / 25) * 25, tw = 55 + (hash(Math.floor(sFar / 25)) % 30);
        ops.push({ d: projSW(ts, tw, 0).fwd, f: () => tree(ctx, projSW, ts, tw) });
      }
      if (Math.floor(sNear / 40) !== Math.floor(sFar / 40)) {
        const ts = Math.floor(sFar / 40) * 40 + 13, tw = -40 - (hash(Math.floor(sFar / 40) + 9) % 20);
        ops.push({ d: projSW(ts, tw, 0).fwd, f: () => tree(ctx, projSW, ts, tw) });
      }
      if (st.gateWorld && 0.5 < sFar && 0.5 >= sNear) ops.push({ d: projSW(0.5, 10, 0).fwd, f: () => gateWorld(ctx, projSW, st.race ? st.race.N : 18) });
    }
    // スタンド（6m 格子）
    for (let g = Math.floor((cam.s - back) / 6) * 6; g < cam.s + DRAW; g += 6) {
      const g0 = g, g1 = g + 6;
      if (!inHome(g0) || !inHome(g1)) continue;
      const dd = projSW(g + 3, 50, 0).fwd;
      if (dd > NEAR) ops.push({ d: dd, f: () => stands(ctx, projSW, g1, g0) });
    }
    // 馬
    if (st.race) {
      for (const h of st.race.horses) {
        if (h.isPlayer && !st.showPlayer) continue;
        const hs = h.s - 1.2;
        if (hs < cam.s - back || hs > cam.s + DRAW) continue;
        const d = projSW(hs, h.x, 0).fwd;
        if (d > 1.2) ops.push({ d: d - 0.02, f: () => drawHorse(ctx, projSW, h, hs, st) });
      }
    }
    ops.sort((a, b) => b.d - a.d);
    for (const op of ops) op.f();
    if (SK.tint) {
      ctx.fillStyle = SK.tint;
      ctx.fillRect(-W, -H, W * 3, H * 3);
    }
    ctx.restore();
  }

  function quad(ctx, a, b, c, d, color, seam) {
    ctx.fillStyle = color;
    if (seam) {
      // 隣の面との間に髪の毛ほどの隙間（斜めの線）が出ないよう、同色で縁取る
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
    ctx.fill();
    if (seam) ctx.stroke();
  }

  function rail(ctx, projSW, sFar, sNear, w) {
    const a = projSW(sFar, w, 1.0), b = projSW(sNear, w, 1.0);
    const a2 = projSW(sFar, w, 0.88), b2 = projSW(sNear, w, 0.88);
    if (a.fwd <= 0.3 || b.fwd <= 0.3) return;
    quad(ctx, a, b, b2, a2, '#ffffff');
    // 支柱
    const p0 = Math.ceil(sNear / 4) * 4;
    if (p0 < sFar) {
      const top = projSW(p0, w, 1), bot = projSW(p0, w, 0);
      if (top.fwd > 0.3) {
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = Math.max(1, top.k * 0.08);
        ctx.beginPath();
        ctx.moveTo(top.sx, top.sy);
        ctx.lineTo(bot.sx, bot.sy);
        ctx.stroke();
      }
    }
  }

  function furlongPost(ctx, projSW, s, m) {
    const top = projSW(s, -1.6, 3.2), bot = projSW(s, -1.6, 0);
    if (top.fwd <= 0.5) return;
    const w = Math.max(2, top.k * 0.18);
    const segN = 6;
    for (let i = 0; i < segN; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#d42a2a';
      const y0 = bot.sy + (top.sy - bot.sy) * (i / segN);
      const y1 = bot.sy + (top.sy - bot.sy) * ((i + 1) / segN);
      ctx.fillRect(top.sx - w / 2, y1, w, y0 - y1);
    }
    // 表示板
    const bw = top.k * 0.9, bh = top.k * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(top.sx - bw / 2, top.sy - bh, bw, bh);
    ctx.fillStyle = '#c21d1d';
    ctx.font = `bold ${Math.max(6, bh * 0.75)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(m / 100), top.sx, top.sy - bh / 2);
  }

  function goalPost(ctx, projSW, s) {
    const top = projSW(s, -2.2, 6), bot = projSW(s, -2.2, 0);
    if (top.fwd <= 0.5) return;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, top.k * 0.2);
    ctx.beginPath();
    ctx.moveTo(bot.sx, bot.sy);
    ctx.lineTo(top.sx, top.sy);
    ctx.stroke();
    // 円盤
    ctx.fillStyle = '#e8262b';
    ctx.beginPath();
    ctx.arc(top.sx, top.sy, top.k * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(top.sx, top.sy, top.k * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // 反対側のポール
    const t2 = projSW(s, C.width + 2.5, 5), b2 = projSW(s, C.width + 2.5, 0);
    ctx.beginPath();
    ctx.moveTo(b2.sx, b2.sy);
    ctx.lineTo(t2.sx, t2.sy);
    ctx.stroke();
  }

  const CROWD_BASE = ['#5d6476', '#6a655e', '#727786', '#565b68'];
  const CROWD_DOTS = ['#ffffff', '#e8d9b8', '#d0453f', '#f2c94c', '#3d6fb6', '#222222', '#f4a3a8'];
  function stands(ctx, projSW, sFar, sNear) {
    const W0 = 44;
    const f0 = projSW(sFar, W0, 0), n0 = projSW(sNear, W0, 0);
    const f1 = projSW(sFar, W0, 4), n1 = projSW(sNear, W0, 4);
    const f2 = projSW(sFar, W0 + 34, 22), n2 = projSW(sNear, W0 + 34, 22);
    const f3 = projSW(sFar, W0 - 2, 27), n3 = projSW(sNear, W0 - 2, 27);
    const f4 = projSW(sFar, W0 + 40, 30), n4 = projSW(sNear, W0 + 40, 30);
    // カメラ面に近い部分は巨大な斜めの板になるので描かない
    for (const p of [f0, n0, f1, n1, f2, n2, f3, n3, f4, n4]) if (p.fwd <= 4) return;
    quad(ctx, f0, n0, n1, f1, '#c9c4bb', true);
    // 観客席：落ち着いた地色 + 色とりどりの観客
    const rowsN = 4;
    for (let r = 0; r < rowsN; r++) {
      const a = lerpP(f1, f2, r / rowsN), b = lerpP(n1, n2, r / rowsN);
      const c = lerpP(n1, n2, (r + 1) / rowsN), d = lerpP(f1, f2, (r + 1) / rowsN);
      quad(ctx, a, b, c, d, CROWD_BASE[(r + Math.floor(sNear / 30)) % CROWD_BASE.length], true);
    }
    const area = Math.abs((n2.sx - f1.sx) * (n1.sy - f2.sy));
    const nDots = Math.min(60, Math.max(3, Math.floor(area / 180)));
    const sz = Math.max(1, Math.min(6, Math.min(n1.k, f1.k) * 0.3));
    let hh = hash(Math.round(sNear) * 7 + 1);
    for (let i = 0; i < nDots; i++) {
      hh = hash(hh + i);
      // 端から離して置く（隣の面に半分隠れて斜めに欠けないように）
      const u = 0.1 + 0.8 * ((hh & 1023) / 1023), v = 0.05 + 0.85 * (((hh >>> 10) & 1023) / 1023);
      const top = lerpP(f1, n1, u), bot = lerpP(f2, n2, u);
      const p = lerpP(top, bot, v);
      ctx.fillStyle = CROWD_DOTS[(hh >>> 20) % CROWD_DOTS.length];
      ctx.fillRect(p.sx, p.sy, sz, sz * 1.3);
    }
    // 屋根
    quad(ctx, f3, n3, n4, f4, '#d5dade', true);
    // 柱（12mおき）
    const pz = Math.ceil(sNear / 12) * 12;
    if (pz < sFar) {
      const pt = projSW(pz, W0 - 2, 27), pb = projSW(pz, W0, 4);
      if (pt.fwd > 0.3) {
        ctx.strokeStyle = '#8d9399';
        ctx.lineWidth = Math.max(1, pb.k * 0.25);
        ctx.beginPath();
        ctx.moveTo(pt.sx, pt.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
    }
  }
  function lerpP(a, b, t) {
    return { sx: a.sx + (b.sx - a.sx) * t, sy: a.sy + (b.sy - a.sy) * t };
  }

  function tree(ctx, projSW, s, w) {
    const base = projSW(s, w, 0), top = projSW(s, w, 9);
    if (base.fwd <= 1) return;
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(base.sx - base.k * 0.3, top.sy + (base.sy - top.sy) * 0.6, base.k * 0.6, (base.sy - top.sy) * 0.4);
    ctx.fillStyle = '#2f6b2c';
    ctx.beginPath();
    ctx.ellipse(top.sx, top.sy + (base.sy - top.sy) * 0.35, base.k * 3, (base.sy - top.sy) * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function gateWorld(ctx, projSW, n) {
    const wEnd = 0.1 + n * 1.15;
    const a = projSW(0.5, -0.2, 2.8), b = projSW(0.5, wEnd, 2.8);
    const a0 = projSW(0.5, -0.2, 0);
    if (a.fwd < 0.5) return;
    ctx.fillStyle = '#2f7d4a';
    ctx.fillRect(a.sx, a.sy, b.sx - a.sx, (a0.sy - a.sy) * 0.18);
    for (let i = 0; i <= n; i++) {
      const w = 0.1 + i * 1.15;
      const t = projSW(0.5, w, 2.8), bt = projSW(0.5, w, 0);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(t.sx - t.k * 0.06, t.sy, t.k * 0.12, bt.sy - t.sy);
      if (i < n) {
        const m = projSW(0.5, w + 0.575, 2.6);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(5, m.k * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), m.sx, m.sy + m.k * 0.2);
      }
    }
  }

  // ---- 他馬（後ろ姿） ----
  function drawHorse(ctx, projSW, h, s, st) {
    const p = projSW(s, h.x, 0);
    if (p.fwd < 1.2) return;
    const k = p.k;
    if (k < 0.6) return;
    const look = h._look || (h._look = horseLook(h, st.race.seed));
    const gal = (st.time * (h.v / 7) + look.phase) * Math.PI * 2;
    const bob = Math.sin(gal * 2) * 0.06 * Math.min(1, h.v / 10);
    const X = p.sx, Y = p.sy;
    const m = (v) => v * k;
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(X, Y, m(0.55), m(0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    // 脚
    ctx.fillStyle = look.coat;
    const legs = [-0.22, -0.08, 0.08, 0.22];
    legs.forEach((lx, i) => {
      const lift = Math.max(0, Math.sin(gal + i * 1.3)) * 0.35 * Math.min(1, h.v / 8);
      ctx.fillRect(X + m(lx) - m(0.05), Y - m(1.0), m(0.1), m(1.0 - lift));
      ctx.fillStyle = '#222';
      ctx.fillRect(X + m(lx) - m(0.055), Y - m(0.12 + lift), m(0.11), m(0.1));
      ctx.fillStyle = look.coat;
    });
    const by = Y - m(1.35 + bob);
    // 尻
    ctx.beginPath();
    ctx.ellipse(X, by, m(0.42), m(0.42), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(X, by + m(0.08), m(0.03), m(0.36), 0, 0, Math.PI * 2);
    ctx.fill();
    // しっぽ
    ctx.strokeStyle = '#1d140e';
    ctx.lineWidth = Math.max(1, m(0.12));
    ctx.beginPath();
    ctx.moveTo(X, by - m(0.25));
    ctx.quadraticCurveTo(X + m(Math.sin(gal) * 0.25), by + m(0.2), X + m(Math.sin(gal + 1) * 0.15), by + m(0.6));
    ctx.stroke();
    // ゼッケン
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X - m(0.4), by - m(0.5), m(0.8), m(0.22));
    if (k > 8) {
      ctx.fillStyle = '#111';
      ctx.font = `bold ${m(0.18)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h.num), X, by - m(0.39));
    }
    // 騎手
    const jy = by - m(0.75);
    const lean = h.effort > 0 ? Math.sin(gal * 2) * 0.06 : 0;
    // ブーツ
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(X - m(0.42), jy + m(0.05), m(0.12), m(0.25));
    ctx.fillRect(X + m(0.3), jy + m(0.05), m(0.12), m(0.25));
    // 胴（勝負服）
    ctx.fillStyle = look.silk1;
    ctx.beginPath();
    ctx.ellipse(X, jy - m(0.2 + lean), m(0.27), m(0.3), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look.silk2;
    if (look.pattern === 1) {
      ctx.fillRect(X - m(0.26), jy - m(0.3 + lean), m(0.52), m(0.08));
      ctx.fillRect(X - m(0.24), jy - m(0.12 + lean), m(0.48), m(0.07));
    } else if (look.pattern === 2) {
      ctx.fillRect(X - m(0.05), jy - m(0.48 + lean), m(0.1), m(0.56));
    } else if (look.pattern === 3) {
      ctx.save();
      ctx.translate(X, jy - m(0.2 + lean));
      ctx.rotate(0.7);
      ctx.fillRect(-m(0.3), -m(0.05), m(0.6), m(0.1));
      ctx.restore();
    }
    // 帽子
    ctx.fillStyle = look.cap;
    ctx.beginPath();
    ctx.arc(X, jy - m(0.55 + lean), m(0.13), 0, Math.PI * 2);
    ctx.fill();
    if (h.frame === 1 || h.frame === 2) {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // ムチ
    if (h.whipTimer > 0.4) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = Math.max(1, m(0.03));
      ctx.beginPath();
      ctx.moveTo(X + m(0.2), jy - m(0.2));
      ctx.lineTo(X + m(0.55), jy + m(0.35));
      ctx.stroke();
    }
    // 近い馬には馬名
    if (st.labels && k > 22 && k < 400) {
      ctx.font = `bold ${Math.min(16, 6 + k * 0.08)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const label = h.num + ' ' + h.name;
      const tw = ctx.measureText(label).width;
      ctx.fillRect(X - tw / 2 - 4, jy - m(0.95) - 14, tw + 8, 16);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, X, jy - m(0.95) - 6);
    }
  }

  // ---- 自分の馬（首・耳・手綱・手・ムチ） ----
  // rd: { gal, effort, steer, whipAnim(0..1), stamina, lean, coat }
  function drawRider(ctx, W, H, rd) {
    const u = (W < H ? H * 0.68 : Math.min(W, H * 1.4)) / 100;
    const cx = W / 2 + rd.steer * u * 3;
    const bob = Math.sin(rd.gal * 2) * u * 1.4;
    const headUp = rd.effort < 0 ? -u * 3 : rd.effort > 0 ? u * 2.5 : 0;
    const pump = rd.effort > 0 ? Math.sin(rd.gal * 2 + 0.6) * u * 3 : 0;
    const topY = H - u * 33 + bob + headUp + pump * 0.4;
    const coat = rd.coat || '#6b3c1e';

    // 首
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(cx - u * 26, H + 2);
    ctx.bezierCurveTo(cx - u * 20, H - u * 14, cx - u * 9, topY + u * 8, cx - u * 6.5, topY + u * 2);
    ctx.lineTo(cx + u * 6.5, topY + u * 2);
    ctx.bezierCurveTo(cx + u * 9, topY + u * 8, cx + u * 20, H - u * 14, cx + u * 26, H + 2);
    ctx.closePath();
    ctx.fill();
    // 陰影
    const sh = ctx.createLinearGradient(cx - u * 26, 0, cx + u * 26, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.35)');
    sh.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    sh.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = sh;
    ctx.fill();
    // 頭頂部と額
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(cx, topY + u * 1.5, u * 6.8, u * 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 耳
    const earT = rd.effort < 0 ? -0.15 : rd.stamina < 20 ? 0.5 : 0.05;
    for (const sd of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + sd * u * 3.6, topY);
      ctx.rotate(sd * (0.25 + earT) + Math.sin(rd.gal) * 0.05);
      ctx.fillStyle = coat;
      ctx.beginPath();
      ctx.moveTo(-u * 1.4, 0);
      ctx.quadraticCurveTo(-u * 0.6, -u * 6, 0, -u * 7);
      ctx.quadraticCurveTo(u * 0.6, -u * 6, u * 1.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(-u * 0.6, -u * 0.5);
      ctx.quadraticCurveTo(0, -u * 5, 0, -u * 5.5);
      ctx.quadraticCurveTo(0, -u * 5, u * 0.6, -u * 0.5);
      ctx.fill();
      ctx.restore();
    }
    // 頭絡（額革）
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = u * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - u * 6.4, topY + u * 2.2);
    ctx.quadraticCurveTo(cx, topY + u * 0.2, cx + u * 6.4, topY + u * 2.2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = u * 0.35;
    ctx.stroke();
    // メンコ風の前髪
    ctx.strokeStyle = '#1b120c';
    ctx.lineWidth = u * 0.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - u * 1 + i * u * 0.5, topY + u * 0.5);
      ctx.quadraticCurveTo(cx + Math.sin(rd.gal + i) * u, topY + u * 3, cx - u * 0.8 + i * u * 0.6, topY + u * 4.5);
      ctx.stroke();
    }
    // たてがみ
    ctx.strokeStyle = '#1b120c';
    ctx.lineWidth = u * 0.7;
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const y = topY + u * 4 + t * (H - topY - u * 4);
      const xw = u * (1.5 + t * 2.5);
      const wave = Math.sin(rd.gal * 2 + i * 0.7) * u * (0.8 + t * 1.6);
      ctx.beginPath();
      ctx.moveTo(cx - xw * 0.2, y);
      ctx.quadraticCurveTo(cx - xw + wave, y + u * 1.2, cx - xw * 1.8 + wave * 1.5, y + u * 2.6);
      ctx.stroke();
    }

    // 手綱と手
    const bitL = { x: cx - u * 7.5, y: topY + u * 6 };
    const bitR = { x: cx + u * 7.5, y: topY + u * 6 };
    const handBack = rd.effort < 0 ? u * 6 : 0;
    const hy = H - u * 7 + handBack - pump + bob * 0.5;
    const hL = { x: cx - u * 14, y: hy };
    const hR = { x: cx + u * 14, y: hy };
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = u * 1.0;
    const slack = rd.effort < 0 ? 0 : u * 3;
    for (const [b, hnd] of [[bitL, hL], [bitR, hR]]) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo((b.x + hnd.x) / 2, (b.y + hnd.y) / 2 + slack, hnd.x, hnd.y);
      ctx.stroke();
    }
    // ムチ（右手）
    const wa = rd.whipAnim;
    let ang;
    if (wa > 0) {
      const t = 1 - wa; // 0→1
      ang = t < 0.35 ? -0.9 - t * 3 : -1.95 + (t - 0.35) * 6;
    } else ang = -0.35;
    ctx.save();
    ctx.translate(hR.x + u * 1.5, hR.y);
    ctx.rotate(ang);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = u * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -u * 22);
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(-u * 0.9, -u * 23.5, u * 1.8, u * 2.5);
    ctx.restore();
    if (wa > 0.3 && wa < 0.8) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${u * 6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(window.I18N ? I18N.t('fx.whip') : 'ビシッ', cx + u * 30, H - u * 22);
    }
    // 手袋と袖
    for (const hnd of [hL, hR]) {
      ctx.fillStyle = '#0b3d91';
      ctx.beginPath();
      ctx.moveTo(hnd.x - u * 3, hnd.y + u * 1);
      ctx.lineTo(hnd.x + (hnd.x < cx ? -u * 10 : u * 10), H + 2);
      ctx.lineTo(hnd.x + (hnd.x < cx ? -u * 2 : u * 18), H + 2);
      ctx.lineTo(hnd.x + u * 3, hnd.y + u * 1);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(hnd.x - u * 3, hnd.y + u * 1.2, u * 6, u * 1.2);
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath();
      ctx.ellipse(hnd.x, hnd.y, u * 3, u * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- ゲートの中（前扉が開く） ----
  function drawGateOverlay(ctx, W, H, open) {
    const u = Math.min(W, H * 1.4) / 100;
    // 横の仕切り
    ctx.fillStyle = '#2f7d4a';
    ctx.fillRect(0, 0, u * 12, H);
    ctx.fillRect(W - u * 12, 0, u * 12, H);
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(u * 12, 0, u * 2, H);
    ctx.fillRect(W - u * 14, 0, u * 2, H);
    // 上の梁
    ctx.fillStyle = '#2f7d4a';
    ctx.fillRect(0, 0, W, u * 8);
    // 前扉（左右に開く）
    const dw = (W / 2 - u * 14) * (1 - open);
    if (dw > 1) {
      for (const sd of [-1, 1]) {
        const x0 = sd < 0 ? u * 14 : W - u * 14 - dw;
        ctx.fillStyle = '#3a8d57';
        ctx.fillRect(x0, H * 0.32, dw, H * 0.4);
        ctx.strokeStyle = '#e6e6e6';
        ctx.lineWidth = u * 0.8;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(x0, H * 0.32 + (i + 0.5) * H * 0.1);
          ctx.lineTo(x0 + dw, H * 0.32 + (i + 0.5) * H * 0.1);
          ctx.stroke();
        }
      }
    }
  }

  // ---- ミニマップ ----
  let mapBounds = null;
  let lapPts = null;
  // 周回コース全体（4角出口から1周）とスタート地点の引き込み線
  function buildLap() {
    const v = C.venue;
    const t0 = trackAt(C.homeStretch);
    let x = t0.x, y = t0.y, th = t0.th;
    const pts = [];
    const segs = [[v.S + v.P, 0], [Math.PI * v.R, C.dir / v.R], [v.S + v.P, 0], [Math.PI * v.R, C.dir / v.R]];
    for (const [len, k] of segs) {
      for (let i = 0; i < len; i += 5) {
        pts.push([x + C.dir * 9 * Math.sin(th), y - C.dir * 9 * Math.cos(th)]);
        const d = Math.min(5, len - i);
        const mid = th + (k * d) / 2;
        x += Math.cos(mid) * d;
        y += Math.sin(mid) * d;
        th += k * d;
      }
    }
    pts.push(pts[0]);
    const chute = C.sections[0].chute ? C.sections[0].len : 0;
    if (chute > 0) {
      pts.push(null);
      for (let s = 0; s <= chute + 5; s += 5) {
        const p = worldAt(s, 9);
        pts.push([p.x, p.y]);
      }
    }
    return pts;
  }
  function drawMinimap(ctx, w, h, race) {
    if (!mapBounds) {
      lapPts = buildLap();
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const p of lapPts) {
        if (!p) continue;
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      }
      mapBounds = { minX, maxX, minY, maxY };
    }
    const b = mapBounds;
    const pad = 10;
    const sc = Math.min((w - pad * 2) / (b.maxX - b.minX + 60), (h - pad * 2) / (b.maxY - b.minY + 60));
    const ox = (w - (b.maxX - b.minX) * sc) / 2 - b.minX * sc;
    const oy = (h + (b.maxY - b.minY) * sc) / 2 + b.minY * sc;
    const tp = (s, wv) => {
      const p = worldAt(s, wv);
      return [ox + p.x * sc, oy - p.y * sc];
    };
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8,28,14,0.88)';
    ctx.fillRect(0, 0, w, h);
    // 周回路
    ctx.strokeStyle = C.surface === 'dirt' ? '#c79a62' : '#6fc56a';
    ctx.lineWidth = Math.max(3, 18 * sc);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    for (const p of lapPts) {
      if (!p) { pen = false; continue; }
      const X = ox + p[0] * sc, Y = oy - p[1] * sc;
      if (pen) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      pen = true;
    }
    ctx.stroke();
    // ゴール
    const [gx, gy] = tp(C.length, -6), [gx2, gy2] = tp(C.length, C.width + 4);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx2, gy2);
    ctx.stroke();
    // 馬
    for (const hs of race.horses) {
      const [x, y] = tp(Math.min(hs.s, C.length + C.postFinish), hs.x);
      ctx.fillStyle = hs.isPlayer ? '#ffd23f' : FRAME_COLORS[hs.frame];
      ctx.beginPath();
      ctx.arc(x, y, hs.isPlayer ? 4.5 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (hs.isPlayer) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  setCourse(Sim.buildCourse(Sim.CALENDAR[4]));

  window.Render = { setCourse, draw, drawRider, drawGateOverlay, drawMinimap, horseLook, worldAt, trackAt };
})();
