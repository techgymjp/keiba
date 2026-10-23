# ダービージョッキー 🏇

騎手目線で1月から12月まで、毎月の大レースを駆け抜けるブラウザゲーム。

ファンファーレが鳴り、ゲートが開いたら、あなたは相棒の背中の上。
進路どり・追う／抑える（体重移動）・ムチを駆使して頂点を目指します。

## 年間12戦

| 月 | レース | コース |
| --- | --- | --- |
| 1月 | 川崎記念（JpnI） | 川崎 ダ2100m 左 |
| 2月 | フェブラリーステークス（G1） | 東京 ダ1600m 左 |
| 3月 | 高松宮記念（G1） | 中京 芝1200m 左 |
| 4月 | 皐月賞（G1） | 中山 芝2000m 右 |
| 5月 | 日本ダービー（G1） | 東京 芝2400m 左 |
| 6月 | 宝塚記念（G1） | 阪神 芝2200m 右 |
| 7月 | ジャパンダートダービー（JpnI・ナイター） | 大井 ダ2000m 右 |
| 8月 | 札幌記念（G2） | 札幌 芝2000m 右 |
| 9月 | スプリンターズステークス（G1） | 中山 芝1200m 右 |
| 10月 | 菊花賞（G1） | 京都 芝3000m 右 |
| 11月 | ジャパンカップ（G1） | 東京 芝2400m 左 |
| 12月 | 有馬記念（G1・夕暮れ） | 中山 芝2500m 右 |

JRAには1月・7月・8月のG1が無いため、1月と7月は地方の交流JpnI、8月は夏の最高峰・札幌記念（G2）にしています。
各コースは直線の長さ・コーナー半径・回り・芝/ダートを実際の競馬場に近づけて再現（直線の短い中山は前が有利、東京は末脚が生きる）。
12戦を終えるとシーズン総括。同じ相棒で翌年へ続きます（脚質は変わりません）。

## 遊び方

`index.html` をブラウザで開くだけ（ビルド不要・外部ライブラリなし）。

```sh
# ローカルサーバーで開く場合
python3 -m http.server 8000
# → http://localhost:8000/
```

| 操作 | キー | スマホ |
| --- | --- | --- |
| 進路（内へ／外へ） | ← / → | ◀ ▶ |
| 追う（前傾） | ↑ | 追う |
| 抑える（手綱を引く） | ↓ | 抑える |
| ムチ・スタート | Space | ムチ |
| 消音 / 一時停止 | M / Esc | ♪ |

## ゲームの核心：相棒の脚質を見抜く

相棒の脚質（**逃げ・先行・差し・追込**）は最初に決まり、乗り替わらない限り変わりません。
脚質は画面に表示されません。

- 合わない位置で走らせると、馬は **力んで** スタミナを浪費したり、**やる気をなくして** 末脚が鈍ったりします
- 合う位置ではリラックスしてスタミナを温存し、直線で持ち味の末脚を発揮します
- 手がかり：レース中の馬の様子、レース後の騎手コメント、戦績ノートの通過順と上がり3F
- **どこかのレースを勝つと脚質が判明** します

レース結果画面の「シェアする」で結果を共有できます（スマホはOSの共有シート、PCはXの投稿画面。12戦目はシーズン総括）。「結果をコピー」で文章をコピーすることもできます。共有文には紹介記事のURL（https://techgym.jp/column/claude-code-game-keiba/ 。`js/game.js` の `SHARE_URL`）が付きます。

データはブラウザ（localStorage）に保存されます。「新しい馬に乗り替わる」で脚質ごとリセット。

## 表示言語（日本語 / 英語）

端末の言語が日本語なら日本語、それ以外は英語で表示します。タイトル画面の「日本語 / English」でいつでも切り替えられます（選んだ言語は保存）。
画面の文言は `js/i18n.js`、レース名・競馬場・馬名・騎手コメントなどレースまわりの文言は `js/sim.js` にあります。
Android のアプリ名も、日本語の端末では「ダービージョッキー」、それ以外では「Derby Jockey」になります。

## Web 版の公開（Vercel）

`vercel.json` で、Vercel が `npm run build` を実行して `www/` を公開するよう設定しています（Android アプリに同梱するのと同じファイルです）。

## Android 版（Google Play 配布用）

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリ内に同梱しているため、ネットにつながっていなくても遊べます。

- 横画面固定・全画面表示（ステータスバー／ナビゲーションバーを隠す）
- プレイ中は画面が暗くならない
- Android の戻るボタンでレース中は一時停止（乗り方・戦績ノートはタイトルへ戻る。タイトル・結果画面ではアプリを終了）
- 別のアプリに切り替えると自動で一時停止し、音も止まる
- 「シェアする」は Android の共有メニューから LINE や X などを選べる
- 乗り方の説明はタッチ操作のボタン名で表示
- タイトル画面にバージョン（`v1.0.0 (build 12)` など）とプライバシーポリシーへのリンクを表示

アプリ ID は `jp.techgym.keiba` です（Google Play に一度公開すると変更できません）。

### 広告（Google AdMob）

Android アプリでのみ広告を表示します（Web 版には広告は出ません）。

| 広告 | タイミング |
| --- | --- |
| インタースティシャル（全画面） | 結果画面で「次走」を押したとき、2 回に 1 回 |
| リワード | 勝てなかったレースの結果画面で「広告を見て、このレースをやり直す」を選ぶと、結果を取り消して同じレースにもう一度挑戦（1 レース 1 回まで） |

- **いまは AdMob 未登録のため、Google のテスト用 ID が入っています。** AdMob でアプリを登録したら次を差し替えます
  - アプリ ID（`ca-app-pub-…~…`）：`android/app/src/main/res/values/strings.xml` の `admob_app_id`
  - 広告ユニット ID（インタースティシャル・リワード）：`js/ads.js` の `UNITS.production`（空のままだと Google Play 版では広告を出しません）
- EU・英国など同意が必要な地域では、初回起動時に Google の同意確認画面が出ます。その地域では、タイトル画面の「広告の設定」から同意内容をいつでも変更できます。
- 動作確認用 APK（Release の `derby-jockey.apk`）は常に **Google のテスト広告** を表示します。自分でタップしても問題ありません。
- Google Play 用の .aab をビルドするときだけ、CI が `ADMOB_MODE=production` で本番の広告に切り替えます（`scripts/build-web.js` が `js/ads-config.js` を書き換えます）。
- 本番の広告を自分でタップするとアカウント停止の対象になるので注意してください。

### ビルド方法

**GitHub Actions（自動）**: Web 版や `android/` を変更して push すると、`.github/workflows/android.yml` が動作確認用の APK を作ります。
既定ブランチのビルドは GitHub の Release（`android-latest`）に自動で載るので、Android 端末で次の URL を開くか QR コードを読み取るだけで最新版をダウンロードできます。

https://github.com/techgymjp/keiba/releases/latest/download/derby-jockey.apk

<img src="docs/apk-qr.png" alt="APK ダウンロード用 QR コード" width="180">

ダウンロードした `derby-jockey.apk` を開き、「提供元不明のアプリ」のインストールを許可するとインストールできます。
動作確認用の署名鍵（`android/app/debug.keystore`）はリポジトリで固定しているので、新しいビルドもアンインストールせずに上書きインストールできます。
（Release に載る APK はデバッグ版です。Google Play には下の手順で作る署名済み .aab を使います）

**手元の PC（Android Studio）**:

```bash
npm ci
npm run android:sync   # Web ファイルを www/ にまとめて Android プロジェクトへコピー
npm run android:open   # Android Studio で開く
```

アイコンと起動画面は `assets/` の元画像から `npx @capacitor/assets generate --android` で生成しています。

### Google Play へ公開する手順

1. アップロード鍵（`upload.jks`）は他のアプリと同じものを使えます。GitHub のリポジトリの Settings → Secrets and variables → Actions に次の 4 つを登録する
   | 名前 | 内容 |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | `base64 -i upload.jks \| tr -d '\n' \| pbcopy` でコピーした文字列 |
   | `ANDROID_KEYSTORE_PASSWORD` | キーストアのパスワード |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | 鍵のパスワード |
2. Actions の「Android build」を実行すると、署名済みの `derby-jockey-release-aab`（.aab）ができる
3. [Google Play Console](https://play.google.com/console) でアプリを作成し、.aab をアップロードする
   （ストア掲載情報・スクリーンショット・プライバシーポリシー・コンテンツのレーティングなどの入力が必要です。
   広告を入れているので「広告を含む」の申告と、データセーフティでの広告 ID の申告が必要です）

バージョン番号（versionCode）は Actions の実行回数が自動で使われます。表示用のバージョン名は `package.json` の `version` です。

## ライセンス

All rights reserved. 著作権はテックジム株式会社に帰属します。無断での複製・改変・再配布、Web サイトやアプリとしての公開を禁止します。ただし、テックジムの受講生が学習目的で複製・改変することは許可します（商用利用は不可。詳しくは `LICENSE`）。

## 構成

| ファイル | 役割 |
| --- | --- |
| `js/sim.js` | 競馬場・年間カレンダー・レースシミュレーション（脚質・スタミナ・位置取り・進路妨害・コーナーロス）。DOM非依存 |
| `js/render.js` | 疑似3Dの騎手目線描画、自馬の首・手綱・ムチ、ミニマップ |
| `js/audio.js` | WebAudio による合成音（オリジナルのファンファーレ、蹄音、歓声、ムチ、ゲート） |
| `js/game.js` | 進行管理、入力、実況、HUD、セーブ |
| `js/i18n.js` | 表示言語（日本語 / 英語）の文言と切り替え |
| `js/ads.js` / `js/ads-config.js` | AdMob 広告（Android アプリのみ） |
| `js/build-info.js` | タイトル画面に出すバージョン（ビルド時に生成） |
| `scripts/build-web.js` | Android 同梱・Vercel 公開用に `www/` を作る |
| `android/` | Android プロジェクト（Capacitor） |
| `tools/balance.js` | 脚質バランス検証（`node tools/balance.js [レース数] [fps] [月]`） |

`?speed=4` を URL に付けると早送り（動作確認用）。
