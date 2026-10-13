// サウンド（すべて WebAudio で合成。外部音源なし）
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let crowdGain = null;
  let noiseBuf = null;
  let muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    // ノイズバッファ（ブラウン寄り）
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.04 * w) / 1.04;
      d[i] = last * 3 + w * 0.15;
    }
    // 観客のざわめき（常時ループ）
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    crowdGain = ctx.createGain();
    crowdGain.gain.value = 0;
    src.connect(bp).connect(crowdGain).connect(master);
    src.start();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // 金管風の音
  function brass(freq, t, dur, vol) {
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(freq * 1.5, t);
    f.frequency.linearRampToValueAtTime(freq * 6, t + 0.05);
    f.frequency.exponentialRampToValueAtTime(freq * 3, t + Math.max(0.1, dur));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.04, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    for (const det of [-6, 5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    f.connect(g).connect(master);
  }

  function timpani(freq, t, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 1);
  }

  function noiseHit(t, dur, vol, freq, type, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq || 2000;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  const NOTE = {};
  (function () {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    for (let oct = 2; oct <= 6; oct++) {
      names.forEach((n, i) => {
        NOTE[n + oct] = 440 * Math.pow(2, (oct * 12 + i - 57) / 12);
      });
    }
  })();

  // 競馬場ごとの味付け（調とテンポ）。大一番は少しゆったり堂々と
  const FANFARE_STYLE = {
    east: { shift: 0, bpm: 112 }, // 東京・中山
    west: { shift: 2, bpm: 120 }, // 京都・阪神・中京
    local: { shift: -3, bpm: 104 }, // 川崎・大井
    north: { shift: 5, bpm: 118 }, // 札幌
    grand: { shift: -2, bpm: 96 }, // ダービー・ジャパンC・有馬記念
  };
  const VENUE_REGION = { tokyoT: 'east', tokyoD: 'east', nakayamaT: 'east', kyotoT: 'west', hanshinT: 'west', chukyoT: 'west', kawasakiD: 'local', oiD: 'local', sapporoT: 'north' };

  // オリジナルのファンファーレ（約13秒）。戻り値: 長さ(秒)
  function fanfare(def) {
    init();
    if (!ctx) return 0;
    const grand = def && (def.month === 5 || def.month === 11 || def.month === 12);
    const fs = FANFARE_STYLE[grand ? 'grand' : (def && VENUE_REGION[def.venue]) || 'east'];
    const mul = Math.pow(2, fs.shift / 12);
    const bpm = fs.bpm;
    const b = 60 / bpm;
    const t0 = now() + 0.15;
    // [音, 拍]  null は休符。3連は 1/3 拍
    const tr = 1 / 3;
    const lead = [
      ['G4', tr], ['G4', tr], ['G4', tr], ['C5', 1], ['E5', 0.5], ['G5', 1.5],
      ['E5', tr], ['E5', tr], ['E5', tr], ['A5', 1], ['G5', 0.5], ['E5', 1], [null, 0.5],
      ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['E5', 0.5], ['C5', 1], ['G4', 1],
      ['A4', tr], ['B4', tr], ['C5', tr], ['D5', 1], ['G4', 0.5], ['D5', 1.5],
      ['C5', tr], ['C5', tr], ['C5', tr], ['F5', 1], ['A5', 0.5], ['C6', 1.5],
      ['B5', 0.5], ['A5', 0.5], ['G5', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5],
      ['G5', tr], ['G5', tr], ['G5', tr], ['A5', tr], ['B5', tr], ['C6', 4.5],
    ];
    // 和声（3度下）
    const third = { C5: 'A4', E5: 'C5', G5: 'E5', A5: 'F5', F5: 'D5', D5: 'B4', C6: 'A5', B5: 'G5', G4: 'E4', A4: 'F4', B4: 'G4', E4: 'C4' };
    let t = t0;
    for (const [n, beats] of lead) {
      const dur = beats * b;
      if (n) {
        brass(NOTE[n] * mul, t, dur * 0.92, 0.09);
        if (beats >= 0.5 && third[n]) brass(NOTE[third[n]] * mul, t, dur * 0.92, 0.055);
      }
      t += dur;
    }
    const end = t;
    // ベースとティンパニ
    const bass = [['C3', 0], ['C3', 3.5], ['A2', 7], ['F2', 9], ['G2', 10.5], ['F2', 14], ['G2', 17], ['C3', 19]];
    for (const [n, at] of bass) {
      brass(NOTE[n] * mul, t0 + at * b, b * 1.8, 0.07);
      timpani(NOTE[n] * mul, t0 + at * b, 0.35);
    }
    // 最後のロール
    for (let i = 0; i < 18; i++) timpani(NOTE.C3 * mul, end - 4.5 * b + i * b * 0.18, 0.12 + i * 0.012);
    timpani(NOTE.C3 * mul, end - 0.1, 0.6);
    brass(NOTE.C4 * mul, end - 4.5 * b, 4.5 * b, 0.06);
    brass(NOTE.G4 * mul, end - 4.5 * b, 4.5 * b, 0.05);
    if (grand) brass(NOTE.E4 * mul, end - 4.5 * b, 4.5 * b, 0.05);
    // 手拍子と歓声
    setCrowd(0.12);
    for (let i = 0; i < 40; i++) noiseHit(end + 0.05 + Math.random() * 1.6, 0.06, 0.25, 2500, 'bandpass', 1.2);
    setTimeout(() => setCrowd(0.45), (end - now()) * 1000);
    setTimeout(() => setCrowd(0.15), (end - now() + 2.5) * 1000);
    return end - now() + 0.6;
  }

  function setCrowd(v) {
    if (!ctx || !crowdGain) return;
    crowdGain.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
  }

  // ゲートが開く音
  function gate() {
    if (!ctx) return;
    const t = now();
    for (const f of [180, 257, 413, 611]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.4);
    }
    noiseHit(t, 0.25, 0.6, 900, 'lowpass', 0.7);
  }

  function whip() {
    if (!ctx) return;
    const t = now();
    noiseHit(t, 0.07, 0.9, 3800, 'highpass', 0.8);
    noiseHit(t + 0.01, 0.04, 0.5, 1500, 'bandpass', 3);
  }

  // 蹄音（1完歩ぶん：4拍のギャロップ）
  function hoof(vol) {
    if (!ctx) return;
    const t = now();
    const offs = [0, 0.055, 0.14, 0.2];
    offs.forEach((o, i) => {
      const tt = t + o;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 - i * 8, tt);
      osc.frequency.exponentialRampToValueAtTime(45, tt + 0.08);
      g.gain.setValueAtTime(vol * 0.5, tt);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
      osc.connect(g).connect(master);
      osc.start(tt);
      osc.stop(tt + 0.12);
      noiseHit(tt, 0.05, vol * 0.35, 500, 'lowpass', 0.7);
    });
  }

  function chime() {
    if (!ctx) return;
    const t = now();
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => brass(f, t + i * 0.12, 0.5, 0.06));
  }

  window.GameAudio = { init, fanfare, setCrowd, gate, whip, hoof, chime, setMuted, isMuted: () => muted };
})();
