// ゲーム進行（タイトル → ファンファーレ → ゲート → レース → 結果）
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'derby-jockey-save-v1';
  // 実時間1秒あたりのレース内秒数（?speed=4 などで早送り。動作確認用）
  const SIM_SPEED = 1.6 * Math.min(8, Math.max(0.25, +new URLSearchParams(location.search).get('speed') || 1));
  const SIM_DT = 1 / 60;

  // ---- セーブデータ ----
  function newSave() {
    const keys = Sim.STYLE_KEYS;
    return {
      horse: {
        name: Sim.randomName(Math.random),
        style: keys[Math.floor(Math.random() * keys.length)],
        ability: 1.018,
      },
      races: [],
      wins: 0,
      revealed: false,
    };
  }
  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (d && d.horse && Sim.STYLES[d.horse.style]) return d;
    } catch (e) { /* 壊れていたら作り直す */ }
    return newSave();
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できなくても遊べる */ }
  }
  let save = loadSave();
  writeSave();

  // ---- キャンバス ----
  const canvas = $('view');
  const ctx = canvas.getContext('2d');
  const mini = $('minimap');
  const mctx = mini.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- 入力 ----
  const keys = { left: false, right: false, up: false, down: false, whip: false };
  let whipPressed = false; // エッジ
  let actionPressed = false; // ゲート用
  const KEYMAP = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ' ': 'whip', Spacebar: 'whip',
  };
  function press(k) {
    if (k === 'whip' && !keys.whip) { whipPressed = true; actionPressed = true; }
    if (k === 'up' && !keys.up) actionPressed = true;
    keys[k] = true;
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = KEYMAP[e.key];
    if (k) {
      e.preventDefault();
      if (!e.repeat) press(k);
      else keys[k] = true;
    }
    if (e.key === 'm' || e.key === 'M') toggleMute();
    if (e.key === 'Escape') togglePause();
    if ((e.key === 'Enter' || e.key === ' ') && phase === 'fanfare') skipFanfare = true;
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.querySelectorAll('#touch button').forEach((b) => {
    const k = b.dataset.key;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); b.classList.add('active'); });
    const up = () => { keys[k] = false; b.classList.remove('active'); };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
  });
  canvas.addEventListener('pointerdown', () => {
    if (phase === 'fanfare') skipFanfare = true;
    if (phase === 'gate') actionPressed = true;
  });
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // ---- 画面 ----
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
    if (id) $(id).classList.remove('hidden');
  }

  function waku(frame) {
    const bg = ['', '#fff', '#222', '#e0262b', '#1f5fd1', '#f2d22e', '#2c9a48', '#f08a1c', '#f59ac0'][frame];
    const fg = frame === 1 || frame === 5 || frame === 8 ? '#111' : '#fff';
    return `<span class="waku" style="background:${bg};color:${fg}">${frame}</span>`;
  }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function refreshTitle() {
    $('horse-name').value = save.horse.name;
    const n = save.races.length;
    const top3 = save.races.filter((r) => r.place <= 3).length;
    $('rec').textContent = n ? `${n}戦${save.wins}勝` : '未出走';
    $('wins').textContent = save.wins + '回';
    $('style-label').textContent = save.revealed ? Sim.STYLES[save.horse.style].name : '？？？';
    $('style-hint').textContent = save.revealed
      ? `脚質「${Sim.STYLES[save.horse.style].name}」が判明済み。連覇を狙え！（3着内 ${top3}回）`
      : n
        ? `まだ脚質は謎。戦績ノートの通過順と騎手メモを手がかりに。（3着内 ${top3}回）`
        : '脚質（逃げ・先行・差し・追込）は生まれつき。乗りながら見極めろ。';
  }

  function refreshHistory() {
    const rows = save.races.slice().reverse().map((r) => `<tr>
      <td>${r.n}</td>
      <td class="${r.place === 1 ? 'place-1' : ''}">${r.place}着</td>
      <td>${esc(r.passing)}</td>
      <td>${r.last3f.toFixed(1)}（${r.last3fRank}位）</td>
      <td>${Sim.formatTime(r.time)}</td>
      <td class="memo">${esc(r.memo)}</td></tr>`);
    $('hist-body').innerHTML = rows.join('') || '<tr><td colspan="6">まだ出走していません。</td></tr>';
  }

  $('horse-name').addEventListener('change', () => {
    const v = $('horse-name').value.trim().slice(0, 10);
    if (v) save.horse.name = v;
    writeSave();
    refreshTitle();
  });
  $('btn-start').addEventListener('click', () => startRace());
  $('btn-again').addEventListener('click', () => startRace());
  $('btn-totitle').addEventListener('click', () => toTitle());
  $('btn-help').addEventListener('click', () => show('help'));
  $('btn-history').addEventListener('click', () => { refreshHistory(); show('history'); });
  document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', () => show('title')));
  $('btn-newhorse').addEventListener('click', () => {
    if (!confirm('今の相棒と別れて、新しい馬に乗り替わりますか？\n（戦績と脚質はリセットされます）')) return;
    save = newSave();
    writeSave();
    refreshTitle();
  });
  $('btn-mute').addEventListener('click', toggleMute);
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-quit').addEventListener('click', () => { paused = false; toTitle(); });

  function toggleMute() {
    GameAudio.setMuted(!GameAudio.isMuted());
    $('btn-mute').classList.toggle('off', GameAudio.isMuted());
  }
  let paused = false;
  function togglePause() {
    if (phase !== 'race' && phase !== 'gate') return;
    paused = !paused;
    if (paused) show('pause'); else show(null);
  }

  // ---- 状態 ----
  let phase = 'title';
  let race = null;
  let phaseT = 0; // フェーズ内の経過（実時間）
  let skipFanfare = false;
  let fanfareLen = 12;
  let gate = null;
  let simAcc = 0;
  let rider = { gal: 0, whipAnim: 0, steer: 0, lean: 0 };
  let comm = null;
  let feel = { text: '', until: 0, last: 0, zoneT: 0, zone: 'ok', flags: {} };
  let lastStride = 0;
  let finishT = 0;
  let raceCount = 0;

  function toTitle() {
    phase = 'title';
    race = null;
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
    $('caption').classList.add('hidden');
    GameAudio.setCrowd(0.05);
    refreshTitle();
    show('title');
  }

  function startRace() {
    GameAudio.init();
    const v = $('horse-name').value.trim();
    if (v) { save.horse.name = v.slice(0, 10); writeSave(); }
    raceCount = save.races.length + 1;
    race = Sim.createRace(save.horse, (Math.random() * 1e9) | 0);
    race.player.startDelay = 999;
    show(null);
    phase = 'fanfare';
    phaseT = 0;
    skipFanfare = false;
    simAcc = 0;
    finishT = 0;
    rider = { gal: 0, whipAnim: 0, steer: 0, lean: 0 };
    feel = { text: '', until: 0, last: -99, zoneT: 0, zone: 'ok', flags: {} };
    comm = { lines: [], flags: {}, nextReport: 450, nextStretch: 0 };
    // 輪乗り（ゲート裏）
    for (const h of race.horses) {
      h._mill = { s: -10 - Math.random() * 14, x: 2 + Math.random() * 18, a: Math.random() * 6.28 };
      h.s = h._mill.s;
      h.v = 1.6;
    }
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
    const p = race.player;
    $('caption').innerHTML = `<div class="c1">第${raceCount}回 東京優駿</div><div class="c2">日本ダービー（G1）</div>
      <div class="c3">東京 芝2400m 左回り・18頭 ／ ${p.num}番 ${esc(p.name)}（${p.popularity}番人気）</div>
      <div class="c3" style="margin-top:14px;opacity:.7">${isTouch ? 'タップ' : 'Enter'}でスキップ</div>`;
    $('caption').classList.remove('hidden');
    fanfareLen = GameAudio.fanfare() || 10;
  }

  function enterGate() {
    phase = 'gate';
    phaseT = 0;
    $('caption').classList.add('hidden');
    for (const h of race.horses) {
      h.s = 0.4;
      h.v = 0;
      h.x = 0.7 + (h.num - 1) * 1.15;
    }
    gate = { readyAt: 1.6, openAt: 1.6 + 1.0 + Math.random() * 1.8, opened: false, open: 0, reacted: false, early: false };
    actionPressed = false;
    whipPressed = false;
    centerMsg('ゲートイン');
    GameAudio.setCrowd(0.06);
    $('hud').classList.remove('hidden');
    if (isTouch) $('touch').classList.remove('hidden');
    updateHud();
  }

  function centerMsg(t) {
    const el = $('center-msg');
    el.textContent = t;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function say(text) {
    comm.lines.push(text);
    if (comm.lines.length > 2) comm.lines.shift();
    $('commentary').innerHTML = comm.lines.map((l, i) => `<div class="${i < comm.lines.length - 1 ? 'old' : ''}">${esc(l)}</div>`).join('');
  }

  function showFeel(text, dur) {
    feel.text = text;
    feel.until = phaseT + (dur || 3);
    $('feel').textContent = text;
    $('feel').classList.add('show');
  }

  // ---- 実況 ----
  function horseLabel(h) {
    return h.isPlayer ? `${h.name}（あなた）` : `${h.num}番${h.name}`;
  }
  function lengthsBetween(a, b) {
    const d = (a.s - b.s) / 2.4;
    if (d < 0.5) return '半馬身';
    if (d < 1.2) return '1馬身';
    if (d > 10) return '10馬身以上';
    return Math.round(d) + '馬身';
  }
  function commentary() {
    const o = race.order;
    const lead = o[0];
    const p = race.player;
    const f = comm.flags;
    if (!f.start && race.t > 1.2) {
      f.start = true;
      const late = race.horses.filter((h) => !h.isPlayer && h.startDelay > 0.6);
      say('スタートしました！' + (late.length ? ` ${late[0].num}番${late[0].name}は出遅れ。` : ' 各馬きれいなスタート。'));
    }
    if (!f.hana && lead.s > 300) {
      f.hana = true;
      say(lead.isPlayer ? `ハナを切ったのはあなたの${p.name}！` : `ハナを切ったのは${horseLabel(lead)}。${p.name}は${p.rank + 1}番手。`);
    }
    if (lead.s > comm.nextReport && lead.s < 1500) {
      comm.nextReport += 400;
      say(`先頭${horseLabel(lead)}、リードは${lengthsBetween(lead, o[1])}。${p.rank === 0 ? '' : `${p.name}は${p.rank + 1}番手。`}`);
    }
    if (!f.k1000 && race.leaderSplits[1000] != null) {
      f.k1000 = true;
      const t = race.leaderSplits[1000];
      const pace = t < 59.5 ? 'ハイペース！' : t > 62.3 ? 'スローペースです。' : '平均的な流れ。';
      say(`1000m通過は${t.toFixed(1)}秒。${pace}`);
    }
    if (!f.c3 && lead.s > 1560) { f.c3 = true; say('3コーナーのカーブへ。各馬が動き出す！'); }
    if (!f.st && lead.s > Sim.COURSE.homeStretch) {
      f.st = true;
      say(`4コーナーを回って最後の直線！ 先頭は${horseLabel(lead)}！`);
      comm.nextStretch = phaseT + 3.5;
    }
    if (f.st && !f.goal && phaseT > comm.nextStretch && lead.s < 2390) {
      comm.nextStretch = phaseT + 3.2;
      const rem = Math.round((Sim.COURSE.length - lead.s) / 50) * 50;
      let t = `残り${rem}m！ ${horseLabel(lead)}先頭、${horseLabel(o[1])}が迫る！`;
      if (p.rank >= 2 && p.rank <= 5 && p.eff > 1.1) t = `残り${rem}m！ 外から${p.name}も伸びてくる！`;
      if (p.rank === 0) t = `残り${rem}m！ ${p.name}が先頭！ このまま押し切るか！`;
      say(t);
    }
    if (!f.goal && race.result == null && race.horses.some((h) => h.finished)) {
      f.goal = true;
      const w = race.horses.filter((h) => h.finished).sort((a, b) => a.finishTime - b.finishTime)[0];
      say(w.isPlayer ? `${w.name}だ！ ${w.name}が今、ダービー馬に輝きました！` : `${horseLabel(w)}、ゴールイン！`);
    }
  }

  // ---- 馬の様子（脚質のヒント） ----
  const FEEL_FWD = ['ハミを噛んで力んでいる…', '行きたがって折り合いを欠いている', '少し掛かり気味だ…'];
  const FEEL_BACK = ['行きっぷりが悪い…', '走る気をなくしかけている', 'どこかイライラしている'];
  const FEEL_OK = ['リズムよく走れている', '気持ちよさそうに走っている', 'いい手応えで折り合っている'];
  function horseFeel(dtReal) {
    const p = race.player;
    if (p.zone !== feel.zone) { feel.zone = p.zone; feel.zoneT = 0; }
    feel.zoneT += dtReal;
    const fl = feel.flags;
    if (p.justWhipped) {
      p.justWhipped = false;
      if (p.s < Sim.SPURT_ZONE && p.s > 50) showFeel('🐴 ムチに驚いて嫌がっている！', 2.2);
    }
    if (p.blocked && p.s > Sim.COURSE.homeStretch && p.effort > 0 && phaseT - feel.last > 3) {
      feel.last = phaseT;
      showFeel('前が壁！ ←→で進路を探せ', 2);
      return;
    }
    if (!fl.spurt && p.s > Sim.SPURT_ZONE) {
      fl.spurt = true;
      showFeel('3〜4コーナー… 仕掛けどころだ', 2.5);
      feel.last = phaseT;
      return;
    }
    if (!fl.tired && p.stamina < 20 && p.s > 400) {
      fl.tired = true;
      showFeel('🐴 手応えが怪しくなってきた…', 2.5);
      feel.last = phaseT;
      return;
    }
    if (p.s < 200 || p.s > Sim.COURSE.homeStretch || phaseT - feel.last < 7) return;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (feel.zone === 'fwd' && feel.zoneT > 2.5) showFeel('🐴 ' + pick(FEEL_FWD), 3);
    else if (feel.zone === 'back' && feel.zoneT > 2.5) showFeel('🐴 ' + pick(FEEL_BACK), 3);
    else if (feel.zone === 'ok' && feel.zoneT > 6) showFeel('🐴 ' + pick(FEEL_OK), 2.5);
    else return;
    feel.last = phaseT;
  }

  // ---- HUD ----
  function updateHud() {
    const p = race.player;
    $('hud-rank').querySelector('.big').textContent = p.finished ? p.place != null ? p.place : p.rank + 1 : p.rank + 1;
    const rem = Math.max(0, Sim.COURSE.length - Math.max(0, p.s));
    $('hud-dist').querySelector('.big').textContent = Math.ceil(rem);
    $('hud-section').textContent = Sim.sectionAt(Math.max(0, p.s)).name;
    $('hud-time').querySelector('.big').textContent = Sim.formatTime(p.finished ? p.finishTime : Math.max(0, race.t));
    const st = Math.max(0, p.stamina);
    const fill = $('hud-stamina').querySelector('.fill');
    fill.style.width = st + '%';
    fill.style.backgroundPosition = `${-(100 - st) * 1.4}px 0`;
    const ride = p.effort > 0 ? (p.s >= Sim.SPURT_ZONE ? '追い出し！' : '押していく') : p.effort < 0 ? '抑えて脚をためる' : '馬なり';
    $('hud-ride').textContent = ride + (p.drafting ? ' ・風よけ' : '') + (p.blocked ? ' ・前が詰まる' : '');
    Render.drawMinimap(mctx, mini.width, mini.height, race);
  }

  // ---- メインループ ----
  let lastTs = performance.now();
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!paused) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    phaseT += dt;
    if (phase === 'fanfare') {
      for (const h of race.horses) {
        const m = h._mill;
        m.a += dt * 0.35;
        h.s = m.s + Math.sin(m.a) * 3;
        h.x = m.x + Math.cos(m.a) * 2;
      }
      rider.gal += dt * 1.2;
      if (skipFanfare || phaseT > fanfareLen) {
        enterGate();
      }
      return;
    }
    if (phase === 'gate') {
      rider.gal += dt * 0.5;
      if (!gate.opened && phaseT > gate.readyAt && !gate.readyShown) {
        gate.readyShown = true;
        centerMsg('体勢完了…');
        actionPressed = false;
      }
      if (!gate.opened && actionPressed && phaseT > gate.readyAt && !gate.early) {
        gate.early = true;
        actionPressed = false;
        showFeel('🐴 ゲートの中で立ち上がった！', 2);
      }
      if (!gate.opened && phaseT >= gate.openAt) {
        gate.opened = true;
        gate.openT = phaseT;
        actionPressed = false;
        GameAudio.gate();
        GameAudio.setCrowd(0.3);
        centerMsg('スタート！');
      }
      if (gate.opened) {
        gate.open = Math.min(1, gate.open + dt * 4);
        const react = phaseT - gate.openT;
        if (!gate.reacted && (actionPressed || react > 0.9)) {
          gate.reacted = true;
          let delay = gate.early ? 0.9 + react : react < 0.25 ? 0 : react;
          race.player.startDelay = race.t + delay * 0.6;
          if (gate.early || react > 0.7) showFeel('出遅れた！', 2);
          else if (react < 0.25) showFeel('好スタート！', 1.6);
          actionPressed = false;
          whipPressed = false;
        }
        stepSim(dt);
        if (phaseT - gate.openT > 1.2) {
          phase = 'race';
          $('center-msg').textContent = '';
        }
      }
      updateHud();
      return;
    }
    if (phase === 'race' || phase === 'finish') {
      stepSim(dt * (phase === 'finish' && phaseT - finishT > 2.5 ? 3 : 1));
      if (phase === 'race') horseFeel(dt);
      commentary();
      if (feel.until && phaseT > feel.until) { $('feel').classList.remove('show'); feel.until = 0; }
      updateHud();
      if (phase === 'race' && race.player.finished) {
        phase = 'finish';
        finishT = phaseT;
        const pl = race.horses.filter((h) => h.finished).length;
        centerMsg(pl === 1 ? '1着！！' : 'ゴール');
        GameAudio.setCrowd(pl === 1 ? 0.8 : 0.4);
        if (pl === 1) GameAudio.chime();
      }
      if (phase === 'finish' && race.over && phaseT - finishT > 3) showResult();
    }
  }

  function stepSim(dtReal) {
    const p = race.player;
    const input = {
      effort: keys.up && !keys.down ? 1 : keys.down && !keys.up ? -1 : 0,
      steer: keys.left && !keys.right ? -1 : keys.right && !keys.left ? 1 : 0,
      whip: false,
    };
    if (p.finished) { input.effort = -1; input.steer = 0; }
    if (whipPressed && !p.finished && race.t >= p.startDelay) {
      input.whip = true;
      rider.whipAnim = 1;
      GameAudio.whip();
    }
    whipPressed = false;
    simAcc += dtReal * SIM_SPEED;
    let steps = 0;
    while (simAcc >= SIM_DT && steps < 30) {
      Sim.step(race, input, SIM_DT);
      input.whip = false;
      simAcc -= SIM_DT;
      steps++;
    }
    // 演出
    rider.gal += dtReal * SIM_SPEED * (p.v / 7) * Math.PI * 2 / 2;
    rider.whipAnim = Math.max(0, rider.whipAnim - dtReal * 2.6);
    rider.steer += ((input.steer || 0) - rider.steer) * Math.min(1, dtReal * 6);
    rider.lean += (input.effort - rider.lean) * Math.min(1, dtReal * 5);
    // 蹄音
    const strideT = 7 / Math.max(1, p.v) / SIM_SPEED;
    if (p.v > 3 && phaseT - lastStride > strideT) {
      lastStride = phaseT;
      GameAudio.hoof(0.5 + Math.min(0.5, p.v / 40));
    }
    // 歓声
    if (phase === 'race') {
      const lead = race.order[0];
      if (lead.s > Sim.COURSE.homeStretch) GameAudio.setCrowd(0.25 + 0.5 * (lead.s - Sim.COURSE.homeStretch) / 525);
      else if (lead.s > 300) GameAudio.setCrowd(0.1);
    }
  }

  function showResult() {
    phase = 'result';
    $('hud').classList.add('hidden');
    $('touch').classList.add('hidden');
    $('feel').classList.remove('show');
    const res = race.result;
    const p = race.player;
    const notes = Sim.analyze(race);
    const passing = [1000, 1545, 1875].map((m) => p.passing[m] || '-').join('-');
    const won = p.place === 1;
    let reveal = '';
    if (won) {
      save.wins++;
      if (!save.revealed) {
        save.revealed = true;
        reveal = `<div class="reveal">相棒の脚質が判明！ ── <b>${Sim.STYLES[save.horse.style].name}</b></div>`;
      }
    }
    save.races.push({
      n: raceCount,
      place: p.place,
      passing,
      last3f: p.last3f,
      last3fRank: p.last3fRank,
      time: p.finishTime,
      memo: notes[0],
    });
    if (save.races.length > 100) save.races.shift();
    writeSave();

    $('res-headline').innerHTML = `
      <div class="sub">第${raceCount}回 日本ダービー ／ ${p.num}番 ${esc(p.name)}</div>
      <div class="place ${won ? 'win' : ''}">${won ? 'ダービー制覇！' : p.place + '着'}</div>
      <div class="sub">タイム ${Sim.formatTime(p.finishTime)} ／ 通過順 ${passing} ／ 上がり3F ${p.last3f.toFixed(1)}（${p.last3fRank}位）</div>${reveal}`;
    const rowFor = (h, i) => {
      const prev = i > 0 ? res[i - 1].finishTime : h.finishTime;
      const margin = i === 0 ? '' : Sim.marginText(h.finishTime - prev);
      const pass = [1000, 1545, 1875].map((m) => h.passing[m] || '-').join('-');
      return `<tr class="${h.isPlayer ? 'me' : ''}"><td class="${i === 0 ? 'place-1' : ''}">${i + 1}</td><td>${waku(h.frame)} ${h.num}</td>
        <td>${esc(h.name)}${h.isPlayer ? ' ★' : ''}</td><td>${Sim.formatTime(h.finishTime)}</td><td>${margin}</td><td>${pass}</td><td>${h.last3f.toFixed(1)}</td></tr>`;
    };
    let rows = res.slice(0, 5).map(rowFor);
    if (p.place > 5) {
      if (p.place > 6) rows.push('<tr class="sep"><td colspan="7">…</td></tr>');
      rows.push(rowFor(p, p.place - 1));
    }
    $('res-body').innerHTML = rows.join('');
    $('res-notes').innerHTML = '<h3>騎手コメント</h3>' + notes.map((n) => `<p>・${esc(n)}</p>`).join('');
    show('result');
  }

  // ---- 描画 ----
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!race) {
      // タイトル背景：スタンド前の芝をゆっくり流す
      const t = performance.now() / 1000;
      Render.draw(ctx, W, H, { race: null, cam: { s: (t * 4) % 300, x: 6, h: 2.4, yaw: 0.35 + Math.sin(t * 0.1) * 0.1 }, time: t });
      return;
    }
    const p = race.player;
    const t = performance.now() / 1000;
    if (phase === 'fanfare') {
      const k = Math.min(1, phaseT / Math.max(4, fanfareLen));
      const yaw = 0.95 * (1 - k * k) + 0.05;
      Render.draw(ctx, W, H, { race, cam: { s: -40 + k * 14, x: -14 + k * 16, h: 3.2 - k * 0.6, yaw }, time: t, showPlayer: true, gateWorld: true });
      return;
    }
    const bob = Math.sin(rider.gal * 2) * 0.05 * Math.min(1, p.v / 10);
    const cam = {
      s: p.s - 1.6 + rider.lean * 0.15,
      x: p.x,
      h: 2.5 - rider.lean * 0.12 + bob,
      yaw: rider.steer * -0.04,
      roll: rider.steer * 0.025 + (Sim.isCurve(p.s) ? -0.02 : 0),
      pitch: rider.lean * 0.02,
    };
    Render.draw(ctx, W, H, { race, cam, time: t, labels: true });
    Render.drawRider(ctx, W, H, {
      gal: rider.gal,
      effort: phase === 'gate' ? 0 : p.effort,
      steer: rider.steer,
      whipAnim: rider.whipAnim,
      stamina: p.stamina,
      coat: Render.horseLook(p, race.seed).coat,
    });
    if (phase === 'gate' && gate) Render.drawGateOverlay(ctx, W, H, gate.open);
    // スパート中の集中線
    if (p.v > 18.5 && phase === 'race') {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = Math.max(W, H) * (0.45 + Math.random() * 0.1);
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * r0, H * 0.44 + Math.sin(a) * r0);
        ctx.lineTo(W / 2 + Math.cos(a) * r0 * 1.3, H * 0.44 + Math.sin(a) * r0 * 1.3);
        ctx.stroke();
      }
    }
  }

  refreshTitle();
  show('title');
  requestAnimationFrame(frame);
})();
