// 表示言語（日本語 / 英語）。端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えも可能
const I18N = (() => {
  const dict = {
    ja: {
      'doc.title': 'ダービージョッキー',
      'logo.sub': 'G1 ROAD ・ 2月〜12月 G1 全24戦',
      'logo.title': 'ダービー<span>ジョッキー</span>',
      'top.lead': '騎手目線で駆ける、JRA 平地G1 全24戦。相棒の脚質を見抜いて、頂点へ。',
      'top.enter': 'はじめる',
      'title.partner': 'あなたの相棒',
      'title.record': '戦績',
      'title.wins': 'ビッグレース',
      'title.style': '脚質',
      'title.start': '出走する',
      'title.history': '戦績ノート',
      'title.help': '乗り方',
      'title.newHorse': '新しい馬に乗り替わる',
      'title.noStarts': '未出走',
      'title.recordV': '{n}戦{w}勝',
      'title.winsV': '{n}勝',
      'title.next': '{y}年目 ・ 第{i}戦／全{n}戦（{m}）',
      'hint.revealed': '脚質「{s}」が判明済み。全G1制覇を狙え！（3着内 {t}回）',
      'hint.unknown': 'まだ脚質は謎。戦績ノートの通過順と騎手メモを手がかりに。（3着内 {t}回）',
      'hint.new': '脚質（逃げ・先行・差し・追込）は生まれつき。乗りながら見極めろ。',
      'confirm.newHorse': '今の相棒と別れて、新しい馬に乗り替わりますか？\n（戦績と脚質はリセットされます）',
      'legal.privacy': 'プライバシーポリシー',
      'legal.adSettings': '広告の設定',
      'url.privacy': 'https://techgym.jp/privacy-policy/',
      'url.play': 'https://play.google.com/store/apps/details?id=jp.techgym.keiba&hl=ja',
      'store.playSub': 'Android アプリ',
      'common.back': '戻る',
      'common.year': '{y}年目',
      'common.place': '{p}着',
      'common.mute': '消音 (M)',

      'help.title': '乗り方',
      'help.keys':
        '<tr><td><kbd>←</kbd><kbd>→</kbd></td><td>進路どり（体重を左右へ）。左回りは左、右回りは右が内ラチ。コーナーは内を回るほど距離得。前が詰まったら外へ。</td></tr>' +
        '<tr><td><kbd>↑</kbd></td><td>追う（前傾）。押している間ペースを上げる。スタミナを使う。</td></tr>' +
        '<tr><td><kbd>↓</kbd></td><td>抑える（手綱を引いて後傾）。ペースを落とし脚をためる。</td></tr>' +
        '<tr><td><kbd>Space</kbd></td><td>ムチ。ゲートが開いた瞬間に押すと好スタート。直線では末脚を引き出す。早すぎるムチは馬が嫌がる。</td></tr>' +
        '<tr><td><kbd>M</kbd> / <kbd>Esc</kbd></td><td>消音 / 一時停止</td></tr>',
      'help.touchKeys':
        '<tr><td><kbd>◀</kbd><kbd>▶</kbd></td><td>進路どり（体重を左右へ）。ボタンの「内へ・外へ」の向きはコースの回りに合わせて変わります。コーナーは内を回るほど距離得。前が詰まったら外へ。</td></tr>' +
        '<tr><td><kbd>追う</kbd></td><td>押している間、前傾して追う。ペースが上がるがスタミナを使う。</td></tr>' +
        '<tr><td><kbd>抑える</kbd></td><td>押している間、手綱を引いて後傾。ペースを落とし脚をためる。</td></tr>' +
        '<tr><td><kbd>ムチ</kbd></td><td>ゲートが開いた瞬間に押すと好スタート。直線では末脚を引き出す。早すぎるムチは馬が嫌がる。</td></tr>' +
        '<tr><td><kbd>♪</kbd></td><td>消音{native}</td></tr>',
      'help.nativePause': '（レース中に戻るボタンで一時停止）',
      'help.knowTitle': 'この馬を知ること',
      'help.know': '馬には生まれつきの脚質があり、ずっと変わりません。',
      'help.styles':
        '<li><b>逃げ</b>…先頭で自分のペースを刻むと強い</li>' +
        '<li><b>先行</b>…前の方の好位でじっと構えると強い</li>' +
        '<li><b>差し</b>…中団で脚をため、直線で差し切る</li>' +
        '<li><b>追込</b>…最後方で我慢し、直線で一気に爆発</li>',
      'help.seasonTitle': 'G1 全24戦',
      'help.season': '2月のフェブラリーステークスから12月の有馬記念まで、JRAの平地G1全24戦に、G1のある週ごとに1戦ずつ挑みます。競馬場・距離（1200m〜3200m）・芝ダート・左右回りはレースごとに違いますが、相棒の脚質はずっと同じ。直線が短いコースでは前が有利、長いコースでは末脚が生きる…コースの個性も味わってください。',
      'help.clue': '合わない位置で走らせると、馬は力んだり、やる気をなくしたりします。レース中の馬の様子、レース後のコメント、通過順と上がり3Fから、相棒の脚質を見抜いてください。勝てば脚質が判明します。',

      'hist.title': '戦績ノート',
      'hist.head': '<tr><th>年</th><th>レース</th><th>着</th><th>通過順</th><th>上がり3F</th><th>タイム</th><th>騎手メモ</th></tr>',
      'hist.empty': 'まだ出走していません。',
      'hist.last3f': '{t}（{r}位）',

      'res.head': '<tr><th>着</th><th>馬番</th><th>馬名</th><th>タイム</th><th>着差</th><th>通過順</th><th>上がり</th></tr>',
      'res.sub': '{y}年目 {m} {race}（{g}）／ {num}番 {name}',
      'res.won': '{race}制覇！',
      'res.line': 'タイム {t} ／ 通過順 {p} ／ 上がり3F {f}（{r}位）',
      'res.reveal': '相棒の脚質が判明！ ── <b>{s}</b>',
      'res.notes': '騎手コメント',
      'res.next': '次走：{m} {race}',
      'res.seasonEnd': 'シーズン終了 ── トップへ',
      'res.toTitle': 'トップへ',
      'title.toTop': '← トップへ戻る',
      'res.retry': '▶ 広告を見て、このレースをやり直す',
      'res.retryLoading': '広告を読み込んでいます…',
      'res.retryFail': '広告を読み込めませんでした。時間をおいて試してください。',
      'res.retrySkip': '最後まで見るとやり直せます。',
      'season.title': '{y}年目 シーズン総括',
      'season.summary': '{n}戦 {w}勝 ・ 3着内 {t}回',
      'season.great': '── 年度代表馬に選ばれました！',
      'season.good': '── 重賞ウイナーの仲間入り！',
      'season.none': '── 来年こそ、この馬の力を引き出そう。',

      'share.btn': 'シェアする',
      'share.copy': '結果をコピー',
      'share.copied': 'コピーしました',
      'share.prompt': 'この文章をコピーしてください',
      'share.title': 'ダービージョッキー',
      'share.dialog': '結果をシェア',
      'share.tag': '#ダービージョッキー',
      'share.season': '🏇 {name}と駆けた{y}年目、G1全{n}戦で{w}勝（3着内{t}回）！',
      'share.seasonWins': '勝ったレース：{list}',
      'share.seasonLast': '最後は{race}で{p}着。',
      'share.won': '🏆 {name}で{race}を制覇！',
      'share.race': '🏇 {race}（{g}）で{name}は{p}着',
      'share.line': 'タイム {t} ／ 通過順 {p} ／ 上がり3F {f}',
      'share.listSep': '・',

      'pause.title': '一時停止',
      'pause.resume': '再開',
      'pause.quit': 'レースをやめる',

      'hud.rank': '番手 / {n}頭',
      'hud.remain': '残り',
      'hud.stamina': '手応え',
      'hud.ridePush': '押していく',
      'hud.rideDrive': '追い出し！',
      'hud.rideHold': '抑えて脚をためる',
      'hud.rideEasy': '馬なり',
      'hud.draft': ' ・風よけ',
      'hud.blocked': ' ・前が詰まる',
      'touch.in': '内へ',
      'touch.out': '外へ',
      'touch.hold': '抑える',
      'touch.push': '追う',
      'touch.whip': 'ムチ',
      'fx.whip': 'ビシッ',

      'cap.head': '{y}年目 第{i}戦 ・ {m}{official}',
      'cap.runner': '{spec} ／ {num}番 {name}（{pop}番人気）',
      'cap.skip': '{k}でスキップ',
      'cap.tap': 'タップ',
      'msg.gateIn': 'ゲートイン',
      'msg.ready': '体勢完了…',
      'msg.start': 'スタート！',
      'msg.win': '1着！！',
      'msg.goal': 'ゴール',

      'feel.rear': '🐴 ゲートの中で立ち上がった！',
      'feel.late': '出遅れた！',
      'feel.goodStart': '好スタート！',
      'feel.earlyWhip': '🐴 ムチに驚いて嫌がっている！',
      'feel.blocked': '前が壁！ {keys}で進路を探せ',
      'feel.spurt': '勝負どころ… 仕掛けるならここからだ',
      'feel.tired': '🐴 手応えが怪しくなってきた…',
      'feel.fwd': ['ハミを噛んで力んでいる…', '行きたがって折り合いを欠いている', '少し掛かり気味だ…'],
      'feel.back': ['行きっぷりが悪い…', '走る気をなくしかけている', 'どこかイライラしている'],
      'feel.ok': ['リズムよく走れている', '気持ちよさそうに走っている', 'いい手応えで折り合っている'],

      'com.you': '{name}（あなた）',
      'com.horse': '{num}番{name}',
      'com.start': 'スタートしました！',
      'com.lateStart': ' {num}番{name}は出遅れ。',
      'com.cleanStart': ' 各馬きれいなスタート。',
      'com.leadYou': 'ハナを切ったのはあなたの{name}！',
      'com.lead': 'ハナを切ったのは{lead}。{name}は{rank}番手。',
      'com.report': '先頭{lead}、リードは{len}。',
      'com.reportYou': '{name}は{rank}番手。',
      'com.split': '{m}m通過は{t}秒。',
      'com.fast': 'ハイペース！',
      'com.slow': 'スローペースです。',
      'com.even': '平均的な流れ。',
      'com.turn3': '3コーナーのカーブへ。各馬が動き出す！',
      'com.stretch': '4コーナーを回って最後の直線！ {venue}の直線は{s}m！ 先頭は{lead}！',
      'com.remain': '残り{m}m！ {lead}先頭、{second}が迫る！',
      'com.remainYouClose': '残り{m}m！ 外から{name}も伸びてくる！',
      'com.remainYouLead': '残り{m}m！ {name}が先頭！ このまま押し切るか！',
      'com.winDerby': '{name}だ！ {name}が今、ダービー馬に輝きました！',
      'com.winArima': '{name}だ！ {name}が今、有馬記念を制しました！ 暮れの中山に大歓声！',
      'com.winRace': '{name}だ！ {name}が今、{race}を制しました！',
      'com.goal': '{lead}、ゴールイン！',
      'len.half': '半馬身',
      'len.one': '1馬身',
      'len.many': '10馬身以上',
      'len.n': '{n}馬身',
    },
    en: {
      'doc.title': 'Derby Jockey',
      'logo.sub': 'G1 ROAD ・ ALL 24 G1 RACES, FEB TO DEC',
      'logo.title': 'Derby <span>Jockey</span>',
      'top.lead': 'Ride all 24 of JRA\'s flat G1 races from the jockey\'s seat. Read your horse and reach the top.',
      'top.enter': 'Start',
      'title.partner': 'Your horse',
      'title.record': 'Record',
      'title.wins': 'Big wins',
      'title.style': 'Running style',
      'title.start': 'Race',
      'title.history': 'Race log',
      'title.help': 'How to ride',
      'title.newHorse': 'Switch to a new horse',
      'title.noStarts': 'No starts',
      'title.recordV': '{n} starts, {w} wins',
      'title.winsV': '{n}',
      'title.next': 'Year {y} ・ Race {i} of {n} ({m})',
      'hint.revealed': 'Running style revealed: {s}. Go for every big race! (Top 3: {t})',
      'hint.unknown': 'Its running style is still a mystery. Use the positions and jockey\'s notes in the race log as clues. (Top 3: {t})',
      'hint.new': 'Every horse is born with a running style — front-runner, stalker, closer or deep closer. Figure it out as you ride.',
      'confirm.newHorse': 'Say goodbye to your horse and switch to a new one?\n(Your record and its running style will be reset.)',
      'legal.privacy': 'Privacy Policy',
      'legal.adSettings': 'Ad settings',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',
      'url.play': 'https://play.google.com/store/apps/details?id=jp.techgym.keiba&hl=en',
      'store.playSub': 'Get it on',
      'common.back': 'Back',
      'common.year': 'Year {y}',
      'common.place': '{p}',
      'common.mute': 'Mute (M)',

      'help.title': 'How to ride',
      'help.keys':
        '<tr><td><kbd>←</kbd><kbd>→</kbd></td><td>Choose your line (shift your weight). The inside rail is on the left on left-handed tracks and on the right on right-handed ones. Hugging the rail saves ground on the turns. If you\'re boxed in, move out.</td></tr>' +
        '<tr><td><kbd>↑</kbd></td><td>Push (lean forward). Speeds up while held, but burns stamina.</td></tr>' +
        '<tr><td><kbd>↓</kbd></td><td>Hold (take a pull and sit back). Slows the pace and saves energy.</td></tr>' +
        '<tr><td><kbd>Space</kbd></td><td>Whip. Press it the moment the gates open for a good start. In the home straight it brings out the finishing kick — but whip too early and the horse resents it.</td></tr>' +
        '<tr><td><kbd>M</kbd> / <kbd>Esc</kbd></td><td>Mute / Pause</td></tr>',
      'help.touchKeys':
        '<tr><td><kbd>◀</kbd><kbd>▶</kbd></td><td>Choose your line (shift your weight). The "Inside / Outside" labels follow the direction of the track. Hugging the rail saves ground on the turns. If you\'re boxed in, move out.</td></tr>' +
        '<tr><td><kbd>Push</kbd></td><td>Hold to lean forward and drive. Speeds up, but burns stamina.</td></tr>' +
        '<tr><td><kbd>Hold</kbd></td><td>Hold to take a pull and sit back. Slows the pace and saves energy.</td></tr>' +
        '<tr><td><kbd>Whip</kbd></td><td>Tap it the moment the gates open for a good start. In the home straight it brings out the finishing kick — but whip too early and the horse resents it.</td></tr>' +
        '<tr><td><kbd>♪</kbd></td><td>Mute{native}</td></tr>',
      'help.nativePause': ' (press Back during a race to pause)',
      'help.knowTitle': 'Know your horse',
      'help.know': 'Every horse is born with a running style, and it never changes.',
      'help.styles':
        '<li><b>Front-runner</b> — strongest when leading and setting its own pace</li>' +
        '<li><b>Stalker</b> — strongest sitting just behind the leaders</li>' +
        '<li><b>Closer</b> — saves its energy mid-pack and pounces in the straight</li>' +
        '<li><b>Deep closer</b> — waits at the very back, then explodes in the straight</li>',
      'help.seasonTitle': 'All 24 G1 races',
      'help.season': 'From the February Stakes to the Arima Kinen in December, you ride in all 24 of JRA\'s flat G1 races — one each week there is a G1. The track, distance (1200 m to 3200 m), turf or dirt, and direction change every time, but your horse\'s running style stays the same. Short straights favour the front, long straights reward a finishing kick — enjoy each track\'s character.',
      'help.clue': 'Ride your horse in the wrong position and it will fight you or lose interest. Read how it feels during the race, the jockey\'s notes afterwards, and its positions and last-600 m times to work out its running style. Win a race and the style is revealed.',

      'hist.title': 'Race log',
      'hist.head': '<tr><th>Year</th><th>Race</th><th>Pos</th><th>Positions</th><th>Last 600m</th><th>Time</th><th>Jockey\'s note</th></tr>',
      'hist.empty': 'No races yet.',
      'hist.last3f': '{t} ({r})',

      'res.head': '<tr><th>Pos</th><th>No.</th><th>Horse</th><th>Time</th><th>Margin</th><th>Positions</th><th>Last 600m</th></tr>',
      'res.sub': 'Year {y} · {m} · {race} ({g}) / No.{num} {name}',
      'res.won': 'You won the {race}!',
      'res.line': 'Time {t} / Positions {p} / Last 600m {f} ({r})',
      'res.reveal': 'Running style revealed — <b>{s}</b>',
      'res.notes': 'Jockey\'s notes',
      'res.next': 'Next: {m} · {race}',
      'res.seasonEnd': 'Season over — back to top',
      'res.toTitle': 'Top',
      'title.toTop': '← Back to top',
      'res.retry': '▶ Watch an ad to run this race again',
      'res.retryLoading': 'Loading the ad…',
      'res.retryFail': 'Couldn\'t load an ad. Please try again later.',
      'res.retrySkip': 'Watch to the end to run the race again.',
      'season.title': 'Year {y} season review',
      'season.summary': '{n} races · {w} wins · {t} top-3 finishes',
      'season.great': '— Named Horse of the Year!',
      'season.good': '— A big-race winner!',
      'season.none': '— Next year, bring out the best in this horse.',

      'share.btn': 'Share',
      'share.copy': 'Copy result',
      'share.copied': 'Copied',
      'share.prompt': 'Copy this text',
      'share.title': 'Derby Jockey',
      'share.dialog': 'Share your result',
      'share.tag': '#DerbyJockey',
      'share.season': '🏇 Year {y} with {name}: {w} wins from all {n} G1 races ({t} top-3 finishes)!',
      'share.seasonWins': 'Won: {list}',
      'share.seasonLast': 'Finished {p} in the {race}.',
      'share.won': '🏆 Won the {race} with {name}!',
      'share.race': '🏇 {name} finished {p} in the {race} ({g})',
      'share.line': 'Time {t} / Positions {p} / Last 600m {f}',
      'share.listSep': ', ',

      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.quit': 'Quit race',

      'hud.rank': '/ {n}',
      'hud.remain': 'To go',
      'hud.stamina': 'Stamina',
      'hud.ridePush': 'Pushing',
      'hud.rideDrive': 'Driving for home!',
      'hud.rideHold': 'Holding, saving energy',
      'hud.rideEasy': 'Cruising',
      'hud.draft': ' · slipstream',
      'hud.blocked': ' · boxed in',
      'touch.in': 'Inside',
      'touch.out': 'Outside',
      'touch.hold': 'Hold',
      'touch.push': 'Push',
      'touch.whip': 'Whip',
      'fx.whip': 'Whack!',

      'cap.head': 'Year {y} · Race {i} · {m}{official}',
      'cap.runner': '{spec} / No.{num} {name} ({pop} favourite)',
      'cap.skip': '{k} to skip',
      'cap.tap': 'Tap',
      'msg.gateIn': 'Loading',
      'msg.ready': 'All set…',
      'msg.start': 'They\'re off!',
      'msg.win': 'YOU WIN!!',
      'msg.goal': 'Finish',

      'feel.rear': '🐴 Reared up in the gate!',
      'feel.late': 'Slow start!',
      'feel.goodStart': 'Great start!',
      'feel.earlyWhip': '🐴 Spooked by the whip — it doesn\'t like that!',
      'feel.blocked': 'Boxed in! Find a gap with {keys}',
      'feel.spurt': 'Crunch time… make your move from here',
      'feel.tired': '🐴 It\'s starting to tire…',
      'feel.fwd': ['Pulling hard against the bit…', 'Too keen — fighting you', 'Running a little too free…'],
      'feel.back': ['Not travelling well…', 'Losing interest', 'Seems frustrated'],
      'feel.ok': ['Travelling in a nice rhythm', 'Enjoying itself', 'Settled and going well'],

      'com.you': '{name} (you)',
      'com.horse': 'No.{num} {name}',
      'com.start': 'And they\'re off!',
      'com.lateStart': ' No.{num} {name} missed the break.',
      'com.cleanStart': ' A clean start for all.',
      'com.leadYou': 'Your {name} goes to the front!',
      'com.lead': '{lead} takes the lead. {name} is {rank}.',
      'com.report': '{lead} leads by {len}.',
      'com.reportYou': ' {name} is {rank}.',
      'com.split': '{m} m in {t} seconds. ',
      'com.fast': 'A fast pace!',
      'com.slow': 'A slow pace.',
      'com.even': 'An even pace.',
      'com.turn3': 'Into the far turn — they\'re starting to move!',
      'com.stretch': 'Round the final turn and into the straight! {s} m to go at {venue}! {lead} leads!',
      'com.remain': '{m} m to go! {lead} in front, {second} closing!',
      'com.remainYouClose': '{m} m to go! {name} is flying down the outside!',
      'com.remainYouLead': '{m} m to go! {name} in front! Can it hold on?',
      'com.winDerby': 'It\'s {name}! {name} wins the Japanese Derby!',
      'com.winArima': 'It\'s {name}! {name} wins the Arima Kinen! Nakayama erupts!',
      'com.winRace': 'It\'s {name}! {name} wins the {race}!',
      'com.goal': '{lead} wins it!',
      'len.half': 'half a length',
      'len.one': 'a length',
      'len.many': '10+ lengths',
      'len.n': '{n} lengths',
    },
  };

  const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const STORE_KEY = 'derby-jockey-lang';
  let saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 保存不可 */ }
  const deviceLang = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
  let lang = dict[saved] ? saved : /^ja\b/i.test(deviceLang) ? 'ja' : 'en';
  const listeners = [];

  // t('res.won', { race: '皐月賞' }) → '皐月賞制覇！'
  function t(key, vars) {
    let s = dict[lang][key];
    if (s === undefined) s = dict.ja[key];
    if (s === undefined) return key;
    if (Array.isArray(s)) return s;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
  }

  // 月（ja: 5月 / en: May）
  function month(m) {
    return lang === 'en' ? MONTHS_EN[m - 1] : m + '月';
  }
  // 開催日（ja: 6月1日 / en: Jun 1）
  function date(m, d) {
    return lang === 'en' ? `${MONTHS_EN[m - 1]} ${d}` : `${m}月${d}日`;
  }
  // 順位（ja: 3 / en: 3rd）。「3着」「3番手」「3番人気」などの数字部分
  function ord(n) {
    if (lang !== 'en') return String(n);
    const t10 = n % 10, t100 = n % 100;
    const suf = t100 >= 11 && t100 <= 13 ? 'th' : t10 === 1 ? 'st' : t10 === 2 ? 'nd' : t10 === 3 ? 'rd' : 'th';
    return n + suf;
  }

  // data-i18n（文字）/ data-i18n-html（タグを含む）/ data-i18n-href（リンク先）/ data-i18n-title（ツールチップ）の付いた要素を書き換える
  function apply() {
    document.documentElement.lang = lang;
    document.title = t('doc.title');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('on', el.dataset.lang === lang));
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) { /* 保存不可 */ }
    apply();
    listeners.forEach((f) => f(l));
  }

  return {
    t, month, date, ord, apply, setLang,
    get lang() { return lang; },
    onChange(f) { listeners.push(f); },
  };
})();
