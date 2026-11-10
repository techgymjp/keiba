// Web 版の公開用・アプリ（Android / iOS）同梱用の Web ファイルを www/ にコピーする
// APP_BUILD=1（npm run build:app）のときは、Web 版だけの部分を取り除く：
//   HTML: <!-- web-only --> … <!-- /web-only -->
//   JS:   // web-only:start … // web-only:end
//   CSS:  /* web-only:start */ … /* web-only:end */
// （アプリの中に他社ストアへのリンクや、アプリでだけ隠す処理があると、App Store の審査で
//   「審査中に隠された機能」とみなされるため。アプリにはそもそも入れない）
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
for (const item of ['index.html', 'css', 'js']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
const appBuild = process.env.APP_BUILD === '1';
if (appBuild) stripWebOnly();
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${appBuild ? 'app' : 'web'}, ads: ${mode}, version: ${version})`);

function stripWebOnly() {
  const MARKS = {
    '.html': /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g,
    '.js': /[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g,
    '.css': /[ \t]*\/\* web-only:start \*\/[\s\S]*?\/\* web-only:end \*\/[ \t]*\n?/g,
  };
  // アプリに残ってはいけない文字列（取り除き忘れがあればビルドを止める）
  const FORBIDDEN = ['web-only', 'play.google.com', 'apps.apple.com', 'speed'];
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  })(out);
  const errors = [];
  for (const f of files) {
    const re = MARKS[path.extname(f)];
    if (!re) continue;
    const text = fs.readFileSync(f, 'utf8');
    const stripped = text.replace(re, '');
    if (stripped !== text) fs.writeFileSync(f, stripped);
    for (const w of FORBIDDEN) {
      if (w === 'speed' ? /[?&'"]speed\b|get\('speed'\)/.test(stripped) : stripped.includes(w)) {
        errors.push(`${path.relative(out, f)}: "${w}" が残っています`);
      }
    }
  }
  if (errors.length) {
    console.error('アプリ用のビルドに Web 版だけの部分が残っています：\n  ' + errors.join('\n  '));
    process.exit(1);
  }
}
