// レースシミュレーション本体（描画・音から独立。Node でもブラウザでも動く）
(function (root) {
  'use strict';

  // ---- コース（東京芝2400m・左回りをモデル化） ----
  const R = 330 / Math.PI; // コーナー半径（内ラチ基準, 約105m）
  const COURSE = {
    length: 2400,
    radius: R,
    width: 22, // 走路幅(m)
    sections: [
      { type: 'straight', start: 0, end: 350, name: 'スタンド前' },
      { type: 'curve', start: 350, end: 680, name: '1〜2コーナー' },
      { type: 'straight', start: 680, end: 1545, name: '向こう正面' },
      { type: 'curve', start: 1545, end: 1875, name: '3〜4コーナー' },
      { type: 'straight', start: 1875, end: 2400, name: '最後の直線' },
    ],
    homeStretch: 1875,
  };

  function sectionAt(s) {
    const secs = COURSE.sections;
    for (let i = 0; i < secs.length; i++) if (s < secs[i].end) return secs[i];
    return secs[secs.length - 1];
  }
  function isCurve(s) {
    return (s >= 350 && s < 680) || (s >= 1545 && s < 1875);
  }

  // ---- 脚質 ----
  // pref: 道中で心地よい位置（0=先頭, 1=最後方）, kick: 末脚の爆発力
  const STYLES = {
    nige: { key: 'nige', name: '逃げ', pref: 0.0, lo: 0.0, hi: 0.07, kick: 0.5, spurt: 1600, relax: 0.9 },
    senko: { key: 'senko', name: '先行', pref: 0.2, lo: 0.08, hi: 0.36, kick: 0.78, spurt: 1700, relax: 0.85 },
    sashi: { key: 'sashi', name: '差し', pref: 0.55, lo: 0.4, hi: 0.72, kick: 1.2, spurt: 1760, relax: 0.8 },
    oikomi: { key: 'oikomi', name: '追込', pref: 0.85, lo: 0.74, hi: 1.0, kick: 1.65, spurt: 1800, relax: 0.74 },
  };
  const STYLE_KEYS = ['nige', 'senko', 'sashi', 'oikomi'];

  const VBASE = 16.6; // 基準速度 m/s
  const SPURT_ZONE = 1650; // ここから末脚を使える
  const HORSE_LEN = 2.4; // 前後の間隔
  const HORSE_WID = 1.05; // 横の間隔

  // 決定的乱数
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const NAME_A = ['サクラ', 'キング', 'メイショウ', 'ゴールド', 'シルバー', 'ダイワ', 'エアー', 'マチカネ', 'トウカイ', 'ナリタ', 'スペシャル', 'グラス', 'ミスター', 'アドマイヤ', 'ハーツ', 'ディープ', 'オルフェ', 'ブラック', 'レッド', 'ホワイト', 'スカイ', 'ライジング', 'ヴィクトリー', 'ローズ', 'ミラクル', 'サンダー', 'ブレイブ', 'ノーブル'];
  const NAME_B = ['ボーイ', 'ヘイロー', 'スター', 'ウイング', 'ストーム', 'ブレイド', 'クラウン', 'ハート', 'フラッシュ', 'ドリーム', 'カイザー', 'ランナー', 'ソード', 'ムーン', 'エース', 'ファイター', 'フォース', 'ジェット', 'ロード', 'シャトル', 'タイガー', 'ペガサス', 'ノヴァ', 'レジェンド', 'アロー', 'リュウセイ'];

  function randomName(rnd) {
    return NAME_A[Math.floor(rnd() * NAME_A.length)] + NAME_B[Math.floor(rnd() * NAME_B.length)];
  }

  // 枠番（18頭立て）
  function frameOf(num) {
    if (num <= 12) return Math.ceil(num / 2);
    if (num <= 15) return 7;
    return 8;
  }

  function pickStyle(rnd) {
    const r = rnd();
    if (r < 0.14) return 'nige';
    if (r < 0.44) return 'senko';
    if (r < 0.76) return 'sashi';
    return 'oikomi';
  }

  function makeHorse(opts) {
    return {
      num: opts.num,
      frame: frameOf(opts.num),
      name: opts.name,
      style: opts.style,
      ability: opts.ability,
      isPlayer: !!opts.isPlayer,
      s: 0,
      x: opts.x,
      v: 0,
      stamina: 100,
      spirit: 1,
      startDelay: opts.startDelay,
      rank: 0,
      whipTimer: 0,
      whipCd: 0,
      whipCount: 0,
      effort: 0,
      eff: 1,
      blocked: false,
      blockedTime: 0,
      drafting: false,
      finished: false,
      finishTime: 0,
      t1800: 0,
      zone: 'ok',
      // 分析用
      fwdStress: 0,
      backStress: 0,
      comfort: 0,
      earlyWhip: 0,
      staminaAtStretch: null,
      passing: {},
      // AI 用
      aiBias: 0,
      aiSpurt: 0,
      aiWhipT: 0,
      aiSteerOut: 0,
    };
  }

  // レース生成
  // player: { name, style, ability }
  function createRace(player, seed) {
    const rnd = mulberry32(seed >>> 0);
    const N = 18;
    const playerNum = 1 + Math.floor(rnd() * N);
    const used = {};
    const horses = [];
    // 有力馬を数頭
    for (let num = 1; num <= N; num++) {
      const x = 0.7 + (num - 1) * 1.15;
      if (num === playerNum) {
        horses.push(makeHorse({ num, name: player.name, style: player.style, ability: player.ability, isPlayer: true, x, startDelay: 0 }));
        continue;
      }
      let name;
      do { name = randomName(rnd); } while (used[name] || name === player.name);
      used[name] = 1;
      const style = pickStyle(rnd);
      const ability = 0.966 + rnd() * 0.04 + (rnd() < 0.15 ? 0.01 : 0);
      const h = makeHorse({ num, name, style, ability, x, startDelay: 0.05 + rnd() * 0.35 + (rnd() < 0.06 ? 0.6 : 0) });
      const st = STYLES[style];
      h.aiBias = (rnd() - 0.5) * 0.008;
      h.aiSpurt = st.spurt + (rnd() - 0.5) * 120;
      h.aiInner = rnd() < 0.7; // 内を好むか
      horses.push(h);
    }
    // 人気（オッズ）: 能力と脚質から
    const sorted = horses.slice().sort((a, b) => b.ability - a.ability + (rnd() - 0.5) * 0.012);
    sorted.forEach((h, i) => { h.popularity = i + 1; });
    return {
      seed,
      rnd,
      N,
      horses,
      player: horses[playerNum - 1],
      t: 0,
      started: false,
      finishedCount: 0,
      order: horses.slice(),
      events: [],
      leaderSplits: {},
      over: false,
    };
  }

  function rankFrac(race, h) {
    return h.rank / (race.N - 1);
  }

  // ---- AI ----
  const AI_CRUISE = { nige: 1.009, senko: 1.003, sashi: 0.998, oikomi: 0.993 };
  function aiControl(race, h, dt) {
    const c = { effort: 0, whip: false, steer: 0, e: null };
    const r = rankFrac(race, h);
    const st = STYLES[h.style];
    if (h.s >= h.aiSpurt) {
      c.effort = 1;
      h.aiWhipT -= dt;
      if (h.s > COURSE.homeStretch && h.aiWhipT <= 0) {
        c.whip = true;
        h.aiWhipT = 0.7 + race.rnd() * 0.9;
      }
    } else if (h.s < 120) {
      c.e = h.style === 'nige' ? 1.06 : h.style === 'senko' ? 1.03 : 1.0;
    } else {
      let e = AI_CRUISE[h.style] + h.aiBias;
      if (r > st.hi + 0.05) e += 0.012;
      else if (r < st.lo - 0.05) e -= 0.012;
      c.e = e;
    }
    // 進路: 前が詰まったら外へ出して追い抜き、空いたら内へ
    if (h.blocked) h.aiSteerOut = h.s >= COURSE.homeStretch - 60 ? 0.8 : 0.5;
    if (h.aiSteerOut > 0) {
      c.steer = 1;
      h.aiSteerOut -= dt;
    } else if (h.s < COURSE.homeStretch - 60 && (h.aiInner || h.s < 350)) {
      c.steer = -1;
    }
    return c;
  }

  // 前方・横の干渉チェック
  function occupied(race, h, x, sFrom, sTo) {
    for (const o of race.horses) {
      if (o === h || o.finished) continue;
      if (Math.abs(o.x - x) < HORSE_WID && o.s > sFrom && o.s < sTo) return o;
    }
    return null;
  }

  // ---- 1ステップ ----
  // input: プレイヤー入力 { effort:-1|0|1, whip:bool, steer:-1|0|1 }
  function step(race, input, dt) {
    if (race.over) {
      // 全頭ゴール後も結果表示までは流し続ける
      for (const h of race.horses) {
        h.v = Math.max(5, h.v - 1.1 * dt);
        h.s += h.v * dt;
      }
      return;
    }
    race.t += dt;
    const t = race.t;
    // 順位（進んでいる順）
    const order = race.horses.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.s - a.s;
    });
    order.forEach((h, i) => { h.rank = i; });
    race.order = order;

    for (const h of order) {
      if (h.finished) {
        // ゴール後は止まらず、徐々に速度を落としながら流していく
        h.v = Math.max(5, h.v - 1.1 * dt);
        h.eff = 0.9;
        h.effort = -1;
        h.s += h.v * dt;
        continue;
      }
      const st = STYLES[h.style];
      const ctrl = h.isPlayer ? input : aiControl(race, h, dt);
      h.effort = ctrl.effort;
      if (t < h.startDelay) continue;

      const r = rankFrac(race, h);
      const spurtOK = h.s >= SPURT_ZONE;
      const inStretch = h.s >= COURSE.homeStretch;

      // 努力度
      let e;
      if (ctrl.e != null && !spurtOK) e = ctrl.e;
      else if (ctrl.effort > 0) e = spurtOK ? 1.02 + 0.085 * st.kick * h.spirit : 1.05;
      else if (ctrl.effort < 0) e = 0.955;
      else e = spurtOK ? 1.01 : 0.99;

      // ムチ
      h.whipCd -= dt;
      h.whipTimer -= dt;
      if (ctrl.whip && h.whipCd <= 0) {
        h.whipCd = 0.35;
        h.whipTimer = 0.8;
        h.whipCount++;
        h.stamina -= 0.35;
        if (!spurtOK) {
          h.earlyWhip++;
          h.spirit = Math.max(0.4, h.spirit - 0.03);
          h.fwdStress += 0.4;
        }
        h.justWhipped = true;
      }
      if (h.whipTimer > 0) {
        const fade = Math.max(0.25, 1 - Math.max(0, h.whipCount - 12) * 0.07);
        e += spurtOK ? 0.035 * st.kick * h.spirit * fade + 0.01 : 0.012;
      }

      // 疲労
      const fatigue = h.stamina > 20 ? 1 : 0.87 + 0.13 * Math.max(0, h.stamina) / 20;
      // 能力差は主に末脚に出る
      const abil = spurtOK ? h.ability : 1 + (h.ability - 1) * 0.3;
      let target = VBASE * abil * e * fatigue;
      if (h.s < 40) target *= 0.6 + h.s / 100; // 発馬直後
      const acc = h.v < target ? (h.s < 60 ? 6 : 2.6) : 2.2;
      if (h.v < target) h.v = Math.min(target, h.v + acc * dt);
      else h.v = Math.max(target, h.v - acc * dt);
      h.eff = e;

      // スタミナ消費（脚質と位置関係が鍵）
      // 末脚はその馬の持ち味に対する相対的な負担で消耗する
      const eCost = spurtOK && e > 1 ? 1 + ((e - 1) * 0.85) / Math.max(1, st.kick) : e;
      let drain = 0.47 * Math.pow(Math.min(eCost, 1.25), 6);
      let m = 1;
      h.zone = 'ok';
      if (h.s > 150 && !inStretch) {
        if (r < st.lo - 1e-6) {
          const d = st.lo - r;
          m = 1 + 2.6 * d;
          h.fwdStress += dt * d;
          h.zone = 'fwd';
        } else if (r > st.hi + 1e-6) {
          const d = r - st.hi;
          m = 1 + 0.7 * d;
          h.spirit = Math.max(0.4, h.spirit - dt * 0.018 * d / 0.3);
          h.backStress += dt * d;
          h.zone = 'back';
        } else {
          m = st.relax;
          h.comfort += dt;
          h.spirit = Math.min(1.1, h.spirit + dt * 0.0015);
        }
      }
      h.drafting = false;
      for (const o of race.horses) {
        if (o === h || o.finished) continue;
        const gap = o.s - h.s;
        if (gap > HORSE_LEN && gap < 7 && Math.abs(o.x - h.x) < 1.2) { h.drafting = true; break; }
      }
      if (h.drafting) m *= 0.82;
      else if (h.rank === 0) m *= 1.1; // 先頭は風を受ける
      h.stamina = Math.max(0, h.stamina - drain * m * dt);

      // 前進（コーナーは外ほど損）
      const k = isCurve(h.s) ? R / (R + h.x) : 1;
      let ds = h.v * dt * k;
      const ahead = occupied(race, h, h.x, h.s, h.s + HORSE_LEN + ds);
      h.blocked = false;
      if (ahead) {
        const maxS = ahead.s - HORSE_LEN;
        if (h.s + ds > maxS) {
          ds = Math.max(0, maxS - h.s);
          h.v = Math.min(h.v, ahead.v);
          h.blocked = true;
          if (inStretch) h.blockedTime += dt;
        }
      }
      const prevS = h.s;
      h.s += ds;

      // 横移動
      if (ctrl.steer) {
        const lat = (h.isPlayer ? 2.6 : 1.6) * dt * ctrl.steer;
        const nx = Math.min(COURSE.width - 1, Math.max(0.5, h.x + lat));
        if (!occupied(race, h, nx, h.s - HORSE_LEN, h.s + HORSE_LEN)) h.x = nx;
      }

      // 通過記録
      for (const mark of [1000, 1545, 1875]) {
        if (prevS < mark && h.s >= mark) h.passing[mark] = h.rank + 1;
      }
      if (prevS < COURSE.homeStretch && h.s >= COURSE.homeStretch) h.staminaAtStretch = h.stamina;
      if (prevS < 1800 && h.s >= 1800) h.t1800 = t - dt * (h.s - 1800) / Math.max(ds, 1e-6);
      for (const mark of [1000]) {
        if (prevS < mark && h.s >= mark && race.leaderSplits[mark] == null) race.leaderSplits[mark] = t;
      }

      if (h.s >= COURSE.length) {
        h.finished = true;
        h.finishTime = t - dt * (h.s - COURSE.length) / Math.max(ds, 1e-6);
        h.last3f = h.finishTime - h.t1800;
        race.finishedCount++;
      }
    }

    if (race.finishedCount >= race.N || t > 400) {
      race.over = true;
      finalize(race);
    }
  }

  function finalize(race) {
    const res = race.horses.slice().sort((a, b) => a.finishTime - b.finishTime);
    res.forEach((h, i) => { h.place = i + 1; });
    const by3f = race.horses.slice().sort((a, b) => a.last3f - b.last3f);
    by3f.forEach((h, i) => { h.last3fRank = i + 1; });
    race.result = res;
  }

  // 着差表記
  function marginText(dtSec) {
    const len = dtSec * 16.6 / 2.4; // 馬身
    if (len < 0.05) return 'ハナ';
    if (len < 0.15) return 'アタマ';
    if (len < 0.3) return 'クビ';
    if (len < 0.6) return '1/2';
    if (len < 0.85) return '3/4';
    if (len < 10) {
      const whole = Math.floor(len + 0.125);
      const fr = len - whole;
      if (fr > 0.375) return whole + ' 1/2';
      if (fr > 0.125) return whole + ' 1/4';
      return String(whole);
    }
    return '大差';
  }

  function formatTime(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  // レース後の騎手コメント（適性のヒント）
  function analyze(race) {
    const h = race.player;
    const notes = [];
    const total = h.fwdStress + h.backStress;
    if (h.fwdStress > 6) notes.push('道中ずっと力んで走っていました。もっと控えて脚をためた方がいいのかもしれません。');
    else if (h.fwdStress > 2.5) notes.push('前半、少し力みがありました。');
    if (h.backStress > 6) notes.push('後ろで揉まれて走る気をなくしていました。もっと前で競馬をさせたいですね。');
    else if (h.backStress > 2.5) notes.push('道中の位置取りに少し不満そうでした。');
    if (h.comfort > 70 && total < 3) notes.push('道中はリズムよく、気持ちよく走れていました。この形が合っているのかも。');
    if (h.earlyWhip > 2) notes.push('早めのムチで馬が嫌がっていました。');
    if (h.last3fRank <= 2) notes.push('上がり3Fはメンバー中' + h.last3fRank + '位。最後の脚は確かです。');
    else if (h.last3fRank >= 12 && h.place > 3) notes.push('最後は伸びを欠きました（上がり3F ' + h.last3fRank + '位）。');
    if (h.stamina > 30) notes.push('ゴール後も余力たっぷり。仕掛けが遅かったか、使いきれませんでした。');
    if (h.staminaAtStretch != null && h.staminaAtStretch < 18) notes.push('直線入口で既に手応えがなく、苦しい競馬でした。');
    if (h.blockedTime > 2.5) notes.push('直線で前が壁になり、追い出しが遅れました。');
    if (!notes.length) notes.push('まだこの馬のことを掴みきれていません。いろいろ試してみましょう。');
    return notes;
  }

  const api = {
    COURSE, STYLES, STYLE_KEYS, VBASE, SPURT_ZONE, HORSE_LEN,
    createRace, step, analyze, sectionAt, isCurve, marginText, formatTime, mulberry32, randomName, frameOf,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
