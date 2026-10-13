// 脚質バランス検証: node tools/balance.js [レース数] [fps] [月(1-12)]
// 行: 馬の真の脚質 / 列: プレイヤーの乗り方
const Sim = require('../js/sim.js');
const N = +process.argv[2] || 150;
const DT = 1 / (+process.argv[3] || 60);
const DEF = Sim.CALENDAR[(+process.argv[4] || 5) - 1];
const strategies = Sim.STYLE_KEYS.concat(['naive']);

function botInput(race, h, strat) {
  const C = race.course;
  const c = { effort: 0, whip: false, steer: 0 };
  const r = h.rank / (race.N - 1);
  if (strat === 'naive') {
    if (h.s > C.homeStretch) { c.effort = 1; c.whip = Math.floor(race.t * 2) % 2 === 0; }
    c.steer = h.s > C.homeStretch && h.blocked ? 1 : -1;
    return c;
  }
  const st = Sim.STYLES[strat];
  if (h.s >= Math.max(C.spurtZone, C.homeStretch + (st.spurt * C.spurtLead) / 225)) {
    c.effort = 1;
    if (h.s > C.homeStretch) c.whip = Math.floor(race.t * 1.5) % 2 === 0;
  } else if (h.s < 120) c.effort = strat === 'nige' || strat === 'senko' ? 1 : 0;
  else if (r > st.hi - 0.02) c.effort = 1;
  else if (r < st.lo + 0.03) c.effort = -1;
  if (h.s > C.homeStretch - 60) c.steer = h.blocked ? 1 : 0;
  else c.steer = -1;
  return c;
}

console.log(`${DEF.month}月 ${DEF.name} ${DEF.length}m ${DEF.field}頭`);
console.log('true\\play ' + strategies.map((s) => s.padStart(14)).join(''));
for (const trueStyle of Sim.STYLE_KEYS) {
  let line = trueStyle.padEnd(10);
  for (const strat of strategies) {
    let sum = 0, wins = 0, top3 = 0;
    for (let i = 0; i < N; i++) {
      const race = Sim.createRace({ name: 'テスト', style: trueStyle, ability: 1.018 }, 1000 + i * 7919, DEF);
      while (!race.over) Sim.step(race, botInput(race, race.player, strat), DT);
      const p = race.player.place;
      sum += p; if (p === 1) wins++; if (p <= 3) top3++;
    }
    line += `${(sum / N).toFixed(1).padStart(5)} ${String(Math.round((wins / N) * 100)).padStart(3)}% ${String(Math.round((top3 / N) * 100)).padStart(3)}%`.padStart(14);
  }
  console.log(line);
}
// 勝ちタイム・AI 脚質別勝利数
const styleWins = {}; let tsum = 0;
for (let i = 0; i < N; i++) {
  const race = Sim.createRace({ name: 'テスト', style: 'sashi', ability: 1.018 }, 5000 + i * 31, DEF);
  while (!race.over) Sim.step(race, botInput(race, race.player, 'naive'), DT);
  const w = race.result[0];
  styleWins[w.style] = (styleWins[w.style] || 0) + 1;
  tsum += w.finishTime;
}
console.log('winner styles', styleWins, 'avg win time', Sim.formatTime(tsum / N));
