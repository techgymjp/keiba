# iOS 版をビルドして App Store に出す手順（Mac での作業）

ダービージョッキーの iOS 版は、Android 版と同じ Capacitor で作っています（`ios/` フォルダ）。JET STRIKE と同じ構成です。
コードの準備はできているので、Mac では「ビルドして App Store Connect にアップロードする」作業だけを行います。

- Bundle ID：`jp.techgym.keiba`（Android と同じ）
- アプリ名：ホーム画面では、日本語の端末で「ダービージョッキー」、それ以外で「Derby Jockey」
- チーム：Team ID `GNM3VTX9YG`（Xcode の設定に入れてあります）。Apple Developer には**個人で登録**しています（App Store の販売元は個人名になります）
- 対応端末：iPhone（横画面固定）。iPad では iPhone 用の画面で動きます
- 広告：AdMob（iOS 用のアプリと広告ユニット）。起動時に「トラッキングの許可」の確認画面が出ます

> **App Store に出す前に**：AdMob の iOS 用のアプリ ID とバナーは設定済みです。インタースティシャルとリワードの広告ユニット ID がまだなので、Claude Code に渡して `js/ads.js` の `UNITS.ios.production` に入れてもらってください。入れるまで、App Store 用のビルドでは全画面広告とリワード広告（負けたレースのやり直し）が出ません。

---

## 0. ブラウザで先に済ませること（ゲームごとに1回）

1. **Apple Developer**（developer.apple.com）→「Certificates, Identifiers & Profiles」→「Identifiers」→「＋」→「App IDs」→「App」
   - Description：`Derby Jockey`（英数字で）
   - Bundle ID：「Explicit」で `jp.techgym.keiba`
   - Capabilities：何もチェックしない（AdMob やシェアに特別な機能は不要）
2. **App Store Connect**（appstoreconnect.apple.com）→「マイ App」→「＋」→「新規 App」
   - プラットフォーム：iOS ／ 名前：`ダービージョッキー` ／ プライマリ言語：日本語
   - バンドル ID：1 で登録した `jp.techgym.keiba` ／ SKU：`keiba`（あとから変更不可）／ ユーザアクセス：アクセス制限なし
3. **AdMob**
   - 「アプリを追加」→ **iOS** →「ストアに掲載されていない」で登録する（Android の「ダービージョッキー」とは別のアプリ）
   - バナー・インタースティシャル・リワードの広告ユニットを作り、アプリ ID と広告ユニット ID 3 つを Claude Code に渡す
   - 「プライバシーとメッセージ」→「欧州の規制」のメッセージに iOS アプリも追加する

---

## 1. Mac の準備（最初の1回だけ）

1. **Xcode** を App Store からインストールする（数十 GB あるので時間がかかります）。インストール後に一度起動し、追加コンポーネントのインストールを済ませる
2. Xcode の「Settings…」→「Accounts」→「＋」で、Apple Developer に登録している Apple ID でサインインする（チームが個人名で表示されれば OK）
3. **Node.js**（LTS 版）を https://nodejs.org/ からインストールする
4. ターミナルでリポジトリを取得する
   ```bash
   cd ~/Desktop   # 置きたい場所（どこでもよい）
   git clone https://github.com/techgymjp/keiba.git
   cd keiba
   npm ci
   ```
   `git` がないと言われたら、表示に従って「コマンドライン・デベロッパツール」をインストールしてから、もう一度実行します。

2回目以降は、`cd keiba` のあと `git pull` と `npm ci` で最新にします。

---

## 2. 自分の iPhone で動作確認する（テスト広告）

```bash
npm run ios:sync    # ゲームのファイルを iOS のプロジェクトにコピー（テスト広告）
npm run ios:open    # Xcode で開く
```

1. iPhone を USB ケーブルで Mac につなぎ、iPhone で「このコンピュータを信頼」を許可する
2. iPhone の「設定」→「プライバシーとセキュリティ」→「デベロッパモード」をオンにする（再起動を求められます。項目がない場合は、Xcode で一度 iPhone を選ぶと表示されます）
3. Xcode の上部で、実行先に自分の iPhone を選ぶ
4. 左の「App」→「Signing & Capabilities」で、「Automatically manage signing」がオン、Team に自分（個人名）のチームが選ばれていることを確認する
5. ▶（Run）を押すと、iPhone にアプリが入って起動する

確認すること：
- 横画面で全画面表示になり、トップ画面から始まる
- トラッキングの確認画面が出る（1回目の起動のみ）
- 画面の端の HUD や操作ボタンが、ノッチ / Dynamic Island や角の丸みに隠れない
- ファンファーレ・蹄音・歓声が鳴る。消音（♪）が効く
- 進路（◀▶）・追う・抑える・ムチで操作できる
- トップ画面・相棒の画面・一時停止・結果画面の下に**テストのバナー**、「出走する」「次走」などで**テストの全画面広告**、負けた結果画面の「広告を見て、このレースをやり直す」で**テストのリワード広告**が出る
- 「シェアする」で iOS の共有メニューが出る

---

## 3. App Store 用にビルドしてアップロードする（本番広告）

```bash
git pull && npm ci
npm run ios:release   # 本番の広告 ID でコピーする（ここが ios:sync と違う）
npm run ios:open
```

1. Xcode の左で「App」→「General」→「Identity」を開き、**Build の番号を前回より大きくする**（初回は 1。アップロードのたびに 2、3…と上げる。同じ番号は二度アップロードできない）。Version はストアに表示されるバージョン（1.0.0）
2. 上部の実行先を「**Any iOS Device (arm64)**」にする
3. メニューの「Product」→「**Archive**」（メニューは画面最上部のメニューバー。全画面表示だと隠れるので、マウスを画面の上端に動かす）
4. 終わると Organizer が開くので、「**Distribute App**」→「**App Store Connect**」→「Upload」で進める（途中の確認は既定のまま「Next」でよい。「Xcode Cloud can automate…」は「Remind Me Later」で閉じてよい）
5. 10〜30 分ほどで、App Store Connect の「TestFlight」タブにビルドが表示される

輸出コンプライアンス（暗号化）の質問は、Info.plist で「独自の暗号化は使っていない」と設定済みなので、聞かれません。

**注意**：`ios:release` でビルドしたアプリは本番の広告が出ます。TestFlight で確認するときも、**本番の広告はタップしない**でください（AdMob のアカウント停止の対象）。Xcode から iPhone に直接入れて試すときは、`npm run ios:sync` でテスト広告に戻してから実行します。

---

## 4. TestFlight で確認し、審査用の録画を撮る

1. App Store Connect の「TestFlight」→「内部テスト」でグループを作り、自分を追加する
2. iPhone に「TestFlight」アプリを App Store から入れ、届いた招待からダービージョッキーをインストールする
3. **審査用の画面録画を撮る**（新しいアカウントの初回の審査では、ほぼ必ず「実機での操作の録画」を求められます。先に用意して審査メモに入れておくと早く進みます）
   - iPhone の「設定」→「コントロールセンター」に「画面収録」を追加する
   - コントロールセンターの ⏺ で収録を始め、**アプリの起動から**次の流れを 2〜3 分で撮る：
     起動 → トラッキングの確認 → トップ画面 →「はじめる」→ 相棒の画面 →「出走する」→ ファンファーレ → ゲート → レース（進路・追う・ムチ）→ ゴール → 結果画面 → 「次走」で次のレースへ
   - 写真アプリに保存された動画は大きいので、Mac に送ってから Finder で右クリック →「選択したビデオファイルをエンコード」→ 720p で小さくする。または Google ドライブにアップロードして共有リンク（リンクを知っている全員が閲覧可）を作る
   - 本番の広告が映っても問題ないが、**タップはしない**

---

## 5. App Store Connect で審査に出す

「配信」タブ（iOS App のバージョン）で入力します。**バージョン番号は 1.0.0** にそろえます（「1.0」のままだと、アップロードしたビルドが選べません）。

| 項目 | 入力内容 |
| --- | --- |
| スクリーンショット | 「Dynamic Island 搭載 iPhone（中型ディスプレイ）」の欄に、`docs/store/ios/6.3inch/` の 2622 × 1206（横向き）を入れる。日本語（`ja-`）と英語（`en-`）各 4 枚。6.9 インチ（2868 × 1320）は受け付けられない |
| ヘッダ・検索結果 | 「ヘッダと検索結果」タブに `docs/store/ios/appstore-header-3840x1646.png` と `appstore-search-3840x2560.png`（ヘッダを入れたら検索結果も必須） |
| サブタイトル・プロモーション用テキスト・概要・キーワード | `docs/store/ios/listing-appstore.md`（日本語と英語） |
| サポート URL | https://techgym.jp/ |
| プライバシーポリシー URL（App 情報と「App のプライバシー」） | https://techgym.jp/privacy-policy/ |
| 著作権 | 2026 TECH GYM K.K. |
| カテゴリ（App 情報） | ゲーム（サブカテゴリ：スポーツ、シミュレーション） |
| コンテンツの配信権（App 情報） | 第三者のコンテンツ：「いいえ」（絵・音はすべて自作。実在のレース名・競馬場名は使っているが、映像・ロゴ・商標の画像は使っていない） |
| ビルド | TestFlight で確認したビルドを選ぶ |
| 年齢制限 | 質問に答える（暴力表現なし。競馬が題材だが、賭け・ギャンブルの要素はない） |
| App のプライバシー | AdMob が収集するデータを申告する（下記） |
| App Review に関する情報 | ログイン不要。連絡先を入力。「メモ」に下の文を入れ、4 章の録画を添付するか共有リンクを書く |

**App のプライバシー（AdMob を使うアプリの目安）**
Google の「Apple の App Store のデータ開示要件への準備」（AdMob のヘルプ）に、AdMob が収集するデータの一覧があります。必ずそちらを見て最終確認してください。目安は次のとおりです。

- 収集する：ID（デバイス ID）、使用状況データ（広告データ、製品の操作）、診断（クラッシュデータ、パフォーマンスデータ、その他の診断データ）、位置情報（おおよその場所）
- 目的：サードパーティ広告、アナリティクス
- ユーザーに関連付け：しない
- トラッキングに使用：デバイス ID と広告データは「する」

**App Review のメモ（英語。Guideline 2.1 の質問に先回りして答える）**

```
Derby Jockey is a single-player horse-racing game. You ride from the jockey's point of view through all 24 of the Japan Racing Association's flat G1 races, and work out your horse's hidden running style over a season.

- Audience: general players aged 13+. No login or account is needed; everything works offline except ads and sharing.
- How to use: tap "Start" → "Race". In the race, use ◀ ▶ to choose a line, "Push" / "Hold" to set the pace and "Whip" in the home straight.
- External services: Google AdMob only (banner, interstitial and rewarded ads). App Tracking Transparency is requested at launch; ads are still shown if tracking is declined. No other SDKs, no analytics, no in-app purchases.
- Regional differences: none, except Google's consent form for ads in the EEA/UK.
- The game has no real-money gambling, betting or prizes. Race and racecourse names are used only as names; all graphics and sounds were made by us. No third-party content.
- A screen recording on a physical iPhone (from launch) is attached / available here: <link>
```

入力が終わったら「審査用に追加」→「審査へ提出」。

---

## 6. 公開後にやること

- AdMob で iOS アプリを App Store のアプリに紐づける（「アプリ」→ iOS のダービージョッキー →「アプリの設定」）
- App Store からインストールして、起動・同意画面・トラッキングの確認・広告を確認する

---

## 7. 自動化の準備（2回目以降を GitHub Actions に任せる場合）

JET STRIKE の `docs/IOS_BUILD.md` の 7 章と同じです。API キー（.p8）と配布用の証明書（.p12）はチーム共通なので、JET STRIKE 用に作ったものをそのまま使えます。
techgymjp は個人のアカウントで全リポジトリ共通の Secrets が使えないため、**このリポジトリにも同じ 5 つを登録します**（https://github.com/techgymjp/keiba/settings/secrets/actions）。

| 名前 | 内容 |
| --- | --- |
| `IOS_DIST_CERT_P12_BASE64` | 証明書（.p12）を変換した文字列 |
| `IOS_DIST_CERT_PASSWORD` | .p12 を書き出したときのパスワード |
| `ASC_KEY_ID` | API キーのキー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `ASC_KEY_P8_BASE64` | API キー（.p8）を変換した文字列 |

```bash
base64 -i 証明書.p12 | tr -d '\n' | pbcopy
base64 -i AuthKey_XXXXXXXXXX.p8 | tr -d '\n' | pbcopy
```

登録が終わったら、Claude Code に「iOS の自動アップロードのワークフローを作って」と頼みます。

**注意**：証明書（.p12）、そのパスワード、API キー（.p8）は、チャット・AI へのアップロード・リポジトリへのコミットで**絶対に共有しない**でください。

いまの `.github/workflows/ios.yml` は、push のたびに「署名なしでシミュレーター向けにビルドできるか」だけを確認します（App Store に出すビルドは 3 章の手順で作ります）。

---

## つまずきやすいところ

| 症状 | 対処 |
| --- | --- |
| アップロードで「同じビルド番号がすでにある」 | General の Build の番号を上げてから Archive し直す |
| Signing でエラー（チームが選べない、証明書がない） | Xcode の Accounts で Apple ID にサインインし直し、Team に自分のチームを選ぶ。「Automatically manage signing」をオンにする |
| 実行先に iPhone が出ない | ケーブルをつなぎ直し、iPhone で「信頼」を許可。デベロッパモードをオンにする |
| 実行先に「iOS 26.x Not Installed」と出る | 「Get」で iOS のシミュレーターと部品をダウンロードする（8 GB ほど。Archive にも必要） |
| ビルドが古いゲームのまま | `npm run ios:sync`（または `ios:release`）を実行し忘れている。`git pull` してから実行し直す |
| アップロードしたビルドが選べない | App Store Connect のバージョンを 1.0.0 に直して保存する |
| 「審査用に追加できません」 | 「コンテンツの配信権」と「App のプライバシー」のプライバシーポリシー URL が入っているか確認する |
| 審査で「Guideline 2.1 - Information Needed」 | 5 章のメモの文と、4 章の実機の録画（共有リンク）を返信する |
| 返信に動画を添付すると「エラーが発生しました」 | 動画が大きすぎる。720p にエンコードするか、Google ドライブの共有リンクを返信文に貼る |
| App Store の審査で「Xcode が古い」と言われる | Xcode を最新版に更新してから Archive し直す |
| 本番広告とテスト広告の取り違え | App Store 用は必ず `npm run ios:release`。Xcode から実機で試すときは `npm run ios:sync` に戻す |
