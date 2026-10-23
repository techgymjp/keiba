// レースシミュレーション本体（描画・音から独立。Node でもブラウザでも動く）
(function (root) {
  'use strict';

  // ---- 表示言語（ゲーム側の I18N から setLang で切り替える。Node では日本語のまま） ----
  let lang = 'ja';
  function setLang(l) { lang = l === 'en' ? 'en' : 'ja'; }
  const L = (ja, en) => (lang === 'en' ? en : ja);

  // ---- 競馬場（実際の寸法を簡略化した周回コース） ----
  // dir: 1=左回り, -1=右回り / S: 4角出口→ゴール / P: ゴール→1角 / R: コーナー半径
  // 両端が半円の周回路なので、向こう正面は必ずホームストレッチ(S+P)と同じ長さになる
  const VENUES = {
    tokyoT: { name: '東京', en: 'Tokyo', dir: 1, S: 525, P: 150, R: 120, width: 24 },
    tokyoD: { name: '東京', en: 'Tokyo', dir: 1, S: 501, P: 130, R: 103, width: 22 },
    nakayamaT: { name: '中山', en: 'Nakayama', dir: -1, S: 310, P: 200, R: 110, width: 22 },
    chukyoT: { name: '中京', en: 'Chukyo', dir: 1, S: 412, P: 150, R: 110, width: 24 },
    chukyoD: { name: '中京', en: 'Chukyo', dir: 1, S: 410, P: 120, R: 95, width: 22 },
    hanshinT: { name: '阪神', en: 'Hanshin', dir: -1, S: 356, P: 150, R: 115, width: 22 }, // 内回り
    hanshinOuterT: { name: '阪神', en: 'Hanshin', dir: -1, S: 474, P: 150, R: 134, width: 24 }, // 外回り
    kyotoT: { name: '京都', en: 'Kyoto', dir: -1, S: 404, P: 180, R: 112, width: 24 }, // 外回り
    kyotoInnerT: { name: '京都', en: 'Kyoto', dir: -1, S: 328, P: 150, R: 105, width: 22 }, // 内回り
  };

  // 1シーズン = JRA の平地G1 全24戦（2025年の開催日程。G1のある週だけ、週に1レース）
  // date: [月, 日] / grand: ファンファーレを大一番の版に
  const G = (o) => Object.assign({ grade: 'G1', surface: 'turf', field: 18, sky: 'day' }, o);
  const CALENDAR = [
    G({ id: 'february', date: [2, 23], name: 'フェブラリーステークス', en: 'February Stakes', venue: 'tokyoD', surface: 'dirt', length: 1600, field: 16 }),
    G({ id: 'takamatsunomiya', date: [3, 30], name: '高松宮記念', en: 'Takamatsunomiya Kinen', venue: 'chukyoT', length: 1200 }),
    G({ id: 'osaka', date: [4, 6], name: '大阪杯', en: 'Osaka Hai', venue: 'hanshinT', length: 2000, field: 16 }),
    G({ id: 'oka', date: [4, 13], name: '桜花賞', en: 'Oka Sho', venue: 'hanshinOuterT', length: 1600 }),
    G({ id: 'satsuki', date: [4, 20], name: '皐月賞', en: 'Satsuki Sho', venue: 'nakayamaT', length: 2000 }),
    G({ id: 'tennoSpring', date: [5, 4], name: '天皇賞（春）', en: 'Tenno Sho (Spring)', venue: 'kyotoT', length: 3200 }),
    G({ id: 'nhkMile', date: [5, 11], name: 'NHKマイルカップ', en: 'NHK Mile Cup', venue: 'tokyoT', length: 1600 }),
    G({ id: 'victoriaMile', date: [5, 18], name: 'ヴィクトリアマイル', en: 'Victoria Mile', venue: 'tokyoT', length: 1600 }),
    G({ id: 'oaks', date: [5, 25], name: 'オークス', en: 'Japanese Oaks', venue: 'tokyoT', length: 2400, official: '優駿牝馬', officialEn: 'Yushun Himba' }),
    G({ id: 'derby', date: [6, 1], name: '日本ダービー', en: 'Japanese Derby', venue: 'tokyoT', length: 2400, official: '東京優駿', officialEn: 'Tokyo Yushun', grand: true }),
    G({ id: 'yasuda', date: [6, 8], name: '安田記念', en: 'Yasuda Kinen', venue: 'tokyoT', length: 1600 }),
    G({ id: 'takarazuka', date: [6, 15], name: '宝塚記念', en: 'Takarazuka Kinen', venue: 'hanshinT', length: 2200 }),
    G({ id: 'sprinters', date: [9, 28], name: 'スプリンターズステークス', en: 'Sprinters Stakes', venue: 'nakayamaT', length: 1200, field: 16 }),
    G({ id: 'shuka', date: [10, 19], name: '秋華賞', en: 'Shuka Sho', venue: 'kyotoInnerT', length: 2000 }),
    G({ id: 'kikuka', date: [10, 26], name: '菊花賞', en: 'Kikuka Sho', venue: 'kyotoT', length: 3000 }),
    G({ id: 'tennoAutumn', date: [11, 2], name: '天皇賞（秋）', en: 'Tenno Sho (Autumn)', venue: 'tokyoT', length: 2000 }),
    G({ id: 'elizabeth', date: [11, 16], name: 'エリザベス女王杯', en: 'Queen Elizabeth II Cup', venue: 'kyotoT', length: 2200 }),
    G({ id: 'mileCS', date: [11, 23], name: 'マイルチャンピオンシップ', en: 'Mile Championship', venue: 'kyotoT', length: 1600 }),
    G({ id: 'japanCup', date: [11, 30], name: 'ジャパンカップ', en: 'Japan Cup', venue: 'tokyoT', length: 2400, grand: true }),
    G({ id: 'championsCup', date: [12, 7], name: 'チャンピオンズカップ', en: 'Champions Cup', venue: 'chukyoD', surface: 'dirt', length: 1800, field: 16 }),
    G({ id: 'hanshinJF', date: [12, 14], name: '阪神ジュベナイルフィリーズ', en: 'Hanshin Juvenile Fillies', venue: 'hanshinOuterT', length: 1600 }),
    G({ id: 'asahiFS', date: [12, 21], name: '朝日杯フューチュリティステークス', en: 'Asahi Hai Futurity Stakes', venue: 'hanshinOuterT', length: 1600 }),
    G({ id: 'hopeful', date: [12, 27], name: 'ホープフルステークス', en: 'Hopeful Stakes', venue: 'nakayamaT', length: 2000 }),
    G({ id: 'arima', date: [12, 28], name: '有馬記念', en: 'Arima Kinen', venue: 'nakayamaT', length: 2500, field: 16, sky: 'dusk', grand: true }),
  ];
  CALENDAR.forEach((d) => { d.month = d.date[0]; d.day = d.date[1]; });
  // 旧版（月1回の12戦）にあって今のカレンダーにないレース名（戦績ノートの英訳用）
  const LEGACY_NAMES = { 川崎記念: 'Kawasaki Kinen', ジャパンダートダービー: 'Japan Dirt Derby', 札幌記念: 'Sapporo Kinen' };

  // ゴールから逆にたどってコースを組み立てる
  function buildCourse(def) {
    const v = VENUES[def.venue];
    const curveLen = Math.PI * v.R;
    const back = [{ type: 'straight', len: v.S, home: true, final: true }];
    const cycle = [
      { type: 'curve', len: curveLen },
      { type: 'straight', len: v.S + v.P, back: true },
      { type: 'curve', len: curveLen },
      { type: 'straight', len: v.S + v.P, home: true },
    ];
    let rem = def.length - v.S;
    for (let i = 0; rem > 1e-6; i++) {
      const c = cycle[i % 4];
      const len = Math.min(c.len, rem);
      // スタートがコーナーの途中になる場合は、その先の直線を延長した引き込み線（ポケット）にする
      back.push(len < c.len && c.type === 'curve' ? { type: 'straight', len, chute: true } : Object.assign({}, c, { len }));
      rem -= len;
    }
    back.reverse();
    const sections = [];
    let s = 0;
    for (const sec of back) {
      sections.push(Object.assign({}, sec, { start: s, end: s + sec.len }));
      s += sec.len;
    }
    // 名前
    const curves = sections.filter((x) => x.type === 'curve');
    curves.forEach((c, i) => {
      const fromEnd = curves.length - 1 - i;
      c.key = fromEnd % 2 === 0 ? 'turn34' : 'turn12';
    });
    for (const x of sections) {
      if (x.type === 'curve') continue;
      x.key = x.final ? 'stretch' : x.chute ? 'start' : x.home ? 'stands' : 'back';
    }
    const length = def.length;
    const homeStretch = length - v.S;
    // 通過順はコーナーごと（最後の4つ）
    const marks = [];
    for (const c of curves) if (c.start > 80) marks.push(Math.round(c.start), Math.round(c.start + c.len / 2));
    // 短距離ほど末脚勝負の区間は短い
    const kickScale = Math.min(1, length / 2000);
    // 直線が短いコースは3コーナー過ぎから早めに動ける（まくり）
    const spurtLead = (225 + 0.6 * Math.max(0, 525 - v.S)) * kickScale;
    const spurtZone = Math.max(homeStretch - spurtLead, length * 0.5);
    const splitAt = length >= 1600 ? 1000 : 600;
    return {
      def,
      venue: v,
      name: v.name,
      dir: v.dir,
      radius: v.R,
      width: Math.max(v.width, def.field * 1.15 + 1.5),
      length,
      surface: def.surface,
      sections,
      homeStretch,
      spurtZone,
      spurtLead,
      kickScale,
      // 直線が短いほど、末脚自慢は一瞬の切れ味で勝負（前残り一辺倒にならないよう補正）
      closerBoost: (0.45 * Math.max(0, 525 - v.S)) / 525,
      marks: marks.slice(-4),
      splitAt,
      postFinish: v.P,
      // 距離が短いほどペースが速い / ダートは時計がかかる
      speed: (1 + (0.035 * (2400 - length)) / 1200) * (def.surface === 'dirt' ? 0.945 : 1),
      // 道中のスタミナ消費・心理の変化はダービー基準(1650m)に合わせて時間を圧縮
      cruiseScale: Math.min(2.6, Math.max(0.6, 1650 / spurtZone)),
    };
  }

  const SECTION_NAMES = {
    turn34: ['3〜4コーナー', 'Far turn'],
    turn12: ['1〜2コーナー', 'First turn'],
    stretch: ['最後の直線', 'Home straight'],
    start: ['スタート地点', 'Start chute'],
    stands: ['スタンド前', 'Past the stands'],
    back: ['向こう正面', 'Backstretch'],
  };
  function sectionName(sec) {
    const n = SECTION_NAMES[sec.key];
    return L(n[0], n[1]);
  }
  function raceName(def) { return L(def.name, def.en); }
  // 戦績の記録からレース名（id があれば今の言語で。旧版の記録は名前から引く）
  function recordRaceName(r) {
    const d = CALENDAR.find((x) => (r.raceId ? x.id === r.raceId : x.name === r.raceName));
    if (d) return raceName(d);
    return L(r.raceName || '', LEGACY_NAMES[r.raceName] || r.raceName || '');
  }
  function officialName(def) { return def.official ? L(def.official, def.officialEn) : ''; }
  function venueName(v) { return L(v.name, v.en); }
  function styleName(key) { return L(STYLES[key].name, STYLES[key].en); }

  function sectionAt(course, s) {
    const secs = course.sections;
    for (let i = 0; i < secs.length; i++) if (s < secs[i].end) return secs[i];
    return secs[secs.length - 1];
  }
  function isCurve(course, s) {
    if (s < 0 || s >= course.length) return false;
    return sectionAt(course, s).type === 'curve';
  }
  // [a, b) のうちコーナーに含まれる長さ（描画で曲率を正確に積分するため）
  function curveOverlap(course, a, b) {
    let sum = 0;
    for (const sec of course.sections) {
      if (sec.type !== 'curve') continue;
      sum += Math.max(0, Math.min(b, sec.end) - Math.max(a, sec.start));
    }
    return sum;
  }
  // スタンド前（ホームストレッチ）か
  function inHome(course, s) {
    if (s < 0) return !!course.sections[0].home;
    if (s >= course.length) return s < course.length + course.postFinish;
    return !!sectionAt(course, s).home;
  }

  // ---- 脚質 ----
  // pref: 道中で心地よい位置（0=先頭, 1=最後方）, kick: 末脚の爆発力
  const STYLES = {
    nige: { key: 'nige', name: '逃げ', en: 'Front-runner', pref: 0.0, lo: 0.0, hi: 0.07, kick: 0.5, spurt: -275, relax: 0.9 },
    senko: { key: 'senko', name: '先行', en: 'Stalker', pref: 0.2, lo: 0.08, hi: 0.36, kick: 0.78, spurt: -175, relax: 0.85 },
    sashi: { key: 'sashi', name: '差し', en: 'Closer', pref: 0.55, lo: 0.4, hi: 0.72, kick: 1.2, spurt: -115, relax: 0.8 },
    oikomi: { key: 'oikomi', name: '追込', en: 'Deep closer', pref: 0.85, lo: 0.74, hi: 1.0, kick: 1.65, spurt: -75, relax: 0.74 },
  };
  const STYLE_KEYS = ['nige', 'senko', 'sashi', 'oikomi'];

  const VBASE = 16.6; // 基準速度 m/s
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

  const NAME_A_EN = ['Sakura', 'King', 'Meisho', 'Gold', 'Silver', 'Daiwa', 'Air', 'Machikane', 'Tokai', 'Narita', 'Special', 'Grass', 'Mister', 'Admire', 'Hearts', 'Deep', 'Orfe', 'Black', 'Red', 'White', 'Sky', 'Rising', 'Victory', 'Rose', 'Miracle', 'Thunder', 'Brave', 'Noble'];
  const NAME_B_EN = ['Boy', 'Halo', 'Star', 'Wing', 'Storm', 'Blade', 'Crown', 'Heart', 'Flash', 'Dream', 'Kaiser', 'Runner', 'Sword', 'Moon', 'Ace', 'Fighter', 'Force', 'Jet', 'Road', 'Shuttle', 'Tiger', 'Pegasus', 'Nova', 'Legend', 'Arrow', 'Ryusei'];

  // 乱数の使い方は言語によらず同じ（同じ種なら同じ馬になる）
  function randomName(rnd) {
    const a = Math.floor(rnd() * NAME_A.length), b = Math.floor(rnd() * NAME_B.length);
    return L(NAME_A[a] + NAME_B[b], NAME_A_EN[a] + ' ' + NAME_B_EN[b]);
  }

  // 枠番（JRA方式：頭数が8を超えると外枠から2頭ずつ）
  function frameOf(num, n) {
    n = n || 18;
    if (n <= 8) return num;
    const base = Math.floor(n / 8), extra = n % 8;
    let k = 0;
    for (let f = 1; f <= 8; f++) {
      k += base + (f > 8 - extra ? 1 : 0);
      if (num <= k) return f;
    }
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
      frame: frameOf(opts.num, opts.field),
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
      t3f: 0,
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
  // player: { name, style, ability } / def: CALENDAR の1レース
  function createRace(player, seed, def) {
    def = def || CALENDAR.find((d) => d.id === 'derby');
    const course = buildCourse(def);
    const rnd = mulberry32(seed >>> 0);
    const N = def.field;
    const playerNum = 1 + Math.floor(rnd() * N);
    const used = {};
    const horses = [];
    // 有力馬を数頭
    for (let num = 1; num <= N; num++) {
      const x = 0.7 + (num - 1) * 1.15;
      if (num === playerNum) {
        horses.push(makeHorse({ num, field: N, name: player.name, style: player.style, ability: player.ability, isPlayer: true, x, startDelay: 0 }));
        continue;
      }
      let name;
      do { name = randomName(rnd); } while (used[name] || name === player.name);
      used[name] = 1;
      const style = pickStyle(rnd);
      const ability = 0.966 + rnd() * 0.04 + (rnd() < 0.15 ? 0.01 : 0);
      const h = makeHorse({ num, field: N, name, style, ability, x, startDelay: 0.05 + rnd() * 0.35 + (rnd() < 0.06 ? 0.6 : 0) });
      const st = STYLES[style];
      h.aiBias = (rnd() - 0.5) * 0.008;
      h.aiSpurt = Math.max(course.spurtZone, course.homeStretch + (st.spurt + (rnd() - 0.5) * 120) * course.spurtLead / 225);
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
      def,
      course,
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
      if (h.s > race.course.homeStretch && h.aiWhipT <= 0) {
        c.whip = true;
        h.aiWhipT = 0.7 + race.rnd() * 0.9;
      }
    } else if (h.s < 120) {
      c.e = h.style === 'nige' ? 1.06 : h.style === 'senko' ? 1.03 : 1.0;
    } else {
      // 長距離ほど隊列が伸びすぎないよう、脚質ごとのペース差を縮める
      const k = Math.min(1, race.course.cruiseScale);
      let e = 1 + (AI_CRUISE[h.style] + h.aiBias - 1) * k;
      if (r > st.hi + 0.05) e += 0.012 * k;
      else if (r < st.lo - 0.05) e -= 0.012 * k;
      c.e = e;
    }
    // 進路: 前が詰まったら外へ出して追い抜き、空いたら内へ
    const C = race.course;
    if (h.blocked) h.aiSteerOut = h.s >= C.homeStretch - 60 ? 0.8 : 0.5;
    if (h.aiSteerOut > 0) {
      c.steer = 1;
      h.aiSteerOut -= dt;
    } else if (h.s < C.homeStretch - 60 && (h.aiInner || h.s < 300)) {
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
    const C = race.course;
    const cs = C.cruiseScale;
    const last3fAt = C.length - 600;
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
      const kick = st.kick * (1 + C.closerBoost * Math.max(0, st.kick - 0.5));
      const ctrl = h.isPlayer ? input : aiControl(race, h, dt);
      h.effort = ctrl.effort;
      if (t < h.startDelay) continue;

      const r = rankFrac(race, h);
      const spurtOK = h.s >= C.spurtZone;
      const inStretch = h.s >= C.homeStretch;

      // 努力度
      let e;
      if (ctrl.e != null && !spurtOK) e = ctrl.e;
      else if (ctrl.effort > 0) e = spurtOK ? 1.02 + 0.085 * kick * h.spirit : 1.05;
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
        e += spurtOK ? 0.035 * kick * h.spirit * fade + 0.01 : 0.012;
      }

      // 疲労
      const fatigue = h.stamina > 20 ? 1 : 0.87 + 0.13 * Math.max(0, h.stamina) / 20;
      // 能力差は主に末脚に出る
      const abil = spurtOK ? h.ability : 1 + (h.ability - 1) * 0.3;
      let target = VBASE * C.speed * abil * e * fatigue;
      if (h.s < 40) target *= 0.6 + h.s / 100; // 発馬直後
      const acc = h.v < target ? (h.s < 60 ? 6 : 2.6) : 2.2;
      if (h.v < target) h.v = Math.min(target, h.v + acc * dt);
      else h.v = Math.max(target, h.v - acc * dt);
      h.eff = e;

      // スタミナ消費（脚質と位置関係が鍵）
      // 末脚はその馬の持ち味に対する相対的な負担で消耗する
      const eCost = spurtOK && e > 1 ? 1 + ((e - 1) * 0.85) / Math.max(1, kick) : e;
      let drain = 0.47 * Math.pow(Math.min(eCost, 1.25), 6);
      let m = spurtOK ? 1 : cs;
      h.zone = 'ok';
      if (h.s > 150 && !inStretch) {
        if (r < st.lo - 1e-6) {
          const d = st.lo - r;
          m *= 1.15 + 2.6 * d; // 少しでも合わない位置なら力む
          h.spirit = Math.max(0.4, h.spirit - dt * cs * 0.012 * (d + 0.05) / 0.3); // 力んで末脚も鈍る
          h.fwdStress += dt * d * cs;
          h.zone = 'fwd';
        } else if (r > st.hi + 1e-6) {
          const d = r - st.hi;
          m *= 1.08 + 0.7 * d;
          h.spirit = Math.max(0.4, h.spirit - dt * cs * 0.018 * (d + 0.06) / 0.3);
          h.backStress += dt * d * cs;
          h.zone = 'back';
        } else {
          m *= st.relax;
          h.comfort += dt * cs;
          h.spirit = Math.min(1.1, h.spirit + dt * cs * 0.0015);
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
      const k = isCurve(C, h.s) ? C.radius / (C.radius + h.x) : 1;
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
        const nx = Math.min(C.width - 1, Math.max(0.5, h.x + lat));
        if (!occupied(race, h, nx, h.s - HORSE_LEN, h.s + HORSE_LEN)) h.x = nx;
      }

      // 通過記録
      for (const mark of C.marks) {
        if (prevS < mark && h.s >= mark) h.passing[mark] = h.rank + 1;
      }
      if (prevS < C.homeStretch && h.s >= C.homeStretch) h.staminaAtStretch = h.stamina;
      if (prevS < last3fAt && h.s >= last3fAt) h.t3f = t - dt * (h.s - last3fAt) / Math.max(ds, 1e-6);
      if (prevS < C.splitAt && h.s >= C.splitAt && race.leaderSplits[C.splitAt] == null) race.leaderSplits[C.splitAt] = t;

      if (h.s >= C.length) {
        h.finished = true;
        h.finishTime = t - dt * (h.s - C.length) / Math.max(ds, 1e-6);
        h.last3f = h.finishTime - h.t3f;
        race.finishedCount++;
      }
    }

    if (race.finishedCount >= race.N || t > 400) {
      race.over = true;
      finalize(race);
    }
  }

  // 通過順の表記（例 "5-5-4-3"）
  function passingText(race, h) {
    return race.course.marks.map((m) => h.passing[m] || '-').join('-') || '-';
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
    if (len < 0.05) return L('ハナ', 'Nose');
    if (len < 0.15) return L('アタマ', 'Head');
    if (len < 0.3) return L('クビ', 'Neck');
    if (len < 0.6) return '1/2';
    if (len < 0.875) return '3/4';
    if (len < 10) {
      const whole = Math.floor(len + 0.125);
      const fr = len - whole;
      if (fr > 0.375) return whole + ' 1/2';
      if (fr > 0.125) return whole + ' 1/4';
      return String(whole);
    }
    return L('大差', 'Distance');
  }

  function formatTime(t) {
    t = Math.round(t * 10) / 10;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  // レース後の騎手コメント（適性のヒント）。{ k: キー, a: 値 } の配列で返し、表示は noteText で（戦績ノートは言語を切り替えても訳される）
  const NOTES = {
    fwdBig: ['道中ずっと力んで走っていました。もっと控えて脚をためた方がいいのかもしれません。', 'It fought me the whole way. Maybe it needs to be held up and saved for later.'],
    fwdSmall: ['前半、少し力みがありました。', 'It was a bit keen early on.'],
    backBig: ['後ろで揉まれて走る気をなくしていました。もっと前で競馬をさせたいですね。', 'It got crowded at the back and lost interest. I\'d like to ride it closer to the pace.'],
    backSmall: ['道中の位置取りに少し不満そうでした。', 'It didn\'t seem happy with where it was running.'],
    comfort: ['道中はリズムよく、気持ちよく走れていました。この形が合っているのかも。', 'It travelled in a lovely rhythm. This might be the way to ride it.'],
    earlyWhip: ['早めのムチで馬が嫌がっていました。', 'It didn\'t like being whipped so early.'],
    fastFinish: ['上がり3Fはメンバー中{r}位。最後の脚は確かです。', 'Its last 600 m was the {r} fastest in the field. It has a real finishing kick.'],
    slowFinish: ['最後は伸びを欠きました（上がり3F {r}位）。', 'It didn\'t pick up at the end (last 600 m: {r}).'],
    leftover: ['ゴール後も余力たっぷり。仕掛けが遅かったか、使いきれませんでした。', 'It still had plenty left after the line. I moved too late, or didn\'t use it all.'],
    emptyEarly: ['直線入口で既に手応えがなく、苦しい競馬でした。', 'It was already running on empty at the top of the straight.'],
    blocked: ['直線で前が壁になり、追い出しが遅れました。', 'I got boxed in during the straight and couldn\'t get going in time.'],
    unknown: ['まだこの馬のことを掴みきれていません。いろいろ試してみましょう。', 'I still haven\'t figured this horse out. Let\'s try different things.'],
  };
  function ordinal(n) {
    if (lang !== 'en') return String(n);
    const t10 = n % 10, t100 = n % 100;
    return n + (t100 >= 11 && t100 <= 13 ? 'th' : t10 === 1 ? 'st' : t10 === 2 ? 'nd' : t10 === 3 ? 'rd' : 'th');
  }
  function noteText(n) {
    if (typeof n === 'string') return n; // 旧版のセーブ（文章のまま保存）
    const t = NOTES[n.k];
    if (!t) return '';
    return L(t[0], t[1]).replace('{r}', n.r != null ? ordinal(n.r) : '');
  }
  function analyze(race) {
    const h = race.player;
    const notes = [];
    const total = h.fwdStress + h.backStress;
    if (h.fwdStress > 6) notes.push({ k: 'fwdBig' });
    else if (h.fwdStress > 2.5) notes.push({ k: 'fwdSmall' });
    if (h.backStress > 6) notes.push({ k: 'backBig' });
    else if (h.backStress > 2.5) notes.push({ k: 'backSmall' });
    if (h.comfort > 70 && total < 3) notes.push({ k: 'comfort' });
    if (h.earlyWhip > 2) notes.push({ k: 'earlyWhip' });
    if (h.last3fRank <= 2) notes.push({ k: 'fastFinish', r: h.last3fRank });
    else if (h.last3fRank >= 12 && h.place > 3) notes.push({ k: 'slowFinish', r: h.last3fRank });
    if (h.stamina > 30) notes.push({ k: 'leftover' });
    if (h.staminaAtStretch != null && h.staminaAtStretch < 18) notes.push({ k: 'emptyEarly' });
    if (h.blockedTime > 2.5) notes.push({ k: 'blocked' });
    if (!notes.length) notes.push({ k: 'unknown' });
    return notes;
  }

  const api = {
    VENUES, CALENDAR, STYLES, STYLE_KEYS, VBASE, HORSE_LEN,
    setLang, raceName, recordRaceName, officialName, venueName, styleName, sectionName, noteText,
    buildCourse, createRace, step, analyze, sectionAt, isCurve, curveOverlap, inHome, marginText, formatTime, mulberry32, randomName, frameOf, passingText,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
