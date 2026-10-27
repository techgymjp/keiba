// Google AdMob 広告（Android / iOS アプリのときだけ動く。Web 版では何もしない）
const Ads = (() => {
  // AdMob では Android と iOS を別のアプリとして登録しているので、広告ユニットも OS ごとに分かれている
  // test は Google 公式のテスト用広告ユニット。production の空のものは本番ビルドでは出さない
  const UNITS = {
    android: {
      test: {
        banner: 'ca-app-pub-3940256099942544/6300978111',
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
      },
      production: {
        banner: 'ca-app-pub-6411535997477460/2801937395',
        interstitial: 'ca-app-pub-6411535997477460/7862692384',
        rewarded: 'ca-app-pub-6411535997477460/5937780356',
      },
    },
    ios: {
      test: {
        banner: 'ca-app-pub-3940256099942544/2934735716',
        interstitial: 'ca-app-pub-3940256099942544/4411468910',
        rewarded: 'ca-app-pub-3940256099942544/1712485313',
      },
      // iOS 用の広告ユニット（空のものはまだ未設定）
      production: {
        banner: 'ca-app-pub-6411535997477460/1391104643',
        interstitial: '',
        rewarded: '',
      },
    },
  };
  const RETRY_MS = 20000; // 読み込みに失敗したら少し待って再挑戦する
  // 全画面広告の最短間隔。操作のたびに続けて出すのは AdMob のポリシー違反になりやすいので、これより短い間隔では出さない
  const INTERSTITIAL_GAP_MS = 60000;
  let lastInterstitial = -Infinity;
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const platform = native && cap.getPlatform && cap.getPlatform() === 'ios' ? 'ios' : 'android';
  const testing = window.AD_MODE !== 'production';
  const ids = UNITS[platform][testing ? 'test' : 'production'];
  const AdMob = native && cap.Plugins ? cap.Plugins.AdMob : null;
  const hasFullscreen = !!(AdMob && ids.interstitial && ids.rewarded); // 全画面・リワード広告を出せるか
  const hasBanner = !!(AdMob && ids.banner);

  let ready = false; // 広告をリクエストしてよい状態（初期化と同意確認が済んだ）
  let showing = false;
  let privacyRequired = false; // 「広告の設定」を利用者が開けるようにする必要があるか（EU など）
  const waiters = {}; // 表示中の広告が閉じたときに呼ぶ処理

  // 広告の種類ごとの読み込み状態
  const slots = {
    inter: { loaded: false, pending: null, load: () => AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: testing }) },
    reward: { loaded: false, pending: null, load: () => AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: testing }) },
  };

  // 読み込みを始め、読み込めたら true で resolve する Promise を返す（読み込み中なら同じ Promise）
  function prepare(kind) {
    const s = slots[kind];
    if (!ready) return Promise.resolve(false);
    if (s.loaded) return Promise.resolve(true);
    if (!s.pending) {
      s.pending = s.load()
        .then(() => { s.loaded = true; return true; })
        .catch(() => { setTimeout(() => prepare(kind), RETRY_MS); return false; })
        .finally(() => { s.pending = null; });
    }
    return s.pending;
  }

  // 読み込み済みでなければ、最大 timeout ミリ秒だけ読み込みを待つ
  function ensureLoaded(kind, timeout) {
    if (slots[kind].loaded) return Promise.resolve(true);
    return Promise.race([prepare(kind), new Promise((r) => setTimeout(() => r(false), timeout))]);
  }

  function finish(kind, result) {
    showing = false;
    syncBanner();
    GameAudio.resume();
    const w = waiters[kind];
    waiters[kind] = null;
    if (w) w(result);
  }

  async function init() {
    try {
      await AdMob.initialize({ initializeForTesting: testing });
    } catch (e) {
      return;
    }
    // EU・英国などで必要な広告の同意確認（必要な地域でだけフォームが出る）。
    // 確認自体が失敗した場合（AdMob 側でメッセージ未設定など）は、同意不要の地域とみなして続ける
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.status === 'REQUIRED' && consent.isConsentFormAvailable) consent = await AdMob.showConsentForm();
      ready = consent.canRequestAds !== false;
      privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (e) {
      ready = true;
    }
    // iOS：App Tracking Transparency の確認（断られても、広告は出せる）
    if (platform === 'ios') {
      try {
        const { status } = await AdMob.trackingAuthorizationStatus();
        if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      } catch (e) { /* 確認できなくても続ける */ }
    }
    let rewarded = false;
    AdMob.addListener('interstitialAdDismissed', () => finish('inter'));
    AdMob.addListener('interstitialAdFailedToShow', () => finish('inter'));
    AdMob.addListener('onRewardedVideoAdShowed', () => { rewarded = false; });
    AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
    AdMob.addListener('onRewardedVideoAdDismissed', () => finish('reward', rewarded));
    AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('reward', false));
    // バナーの高さが変わったら、画面の下にその分の余白を空ける（ボタンが隠れないように）
    AdMob.addListener('bannerAdSizeChanged', (size) => {
      // 隠したときは高さ 0 が来る（表示処理の完了前に届くこともあるので、届いた高さをそのまま使う）
      document.documentElement.style.setProperty('--banner-h', (size && size.height ? size.height : 0) + 'px');
    });
    if (hasFullscreen) {
      prepare('inter');
      prepare('reward');
    }
    syncBanner();
  }

  // ---- バナー（タイトル・一時停止・結果画面の下に表示。レース中は隠す） ----
  let bannerWanted = false; // ゲームが表示したいか
  let bannerOn = false; // 実際に表示中か
  let bannerCreated = false;
  let bannerBusy = false;
  let bannerRetry = null;
  async function syncBanner() {
    if (!hasBanner || !ready || bannerBusy) return;
    const want = bannerWanted && !showing;
    if (want === bannerOn) return;
    bannerBusy = true;
    let failed = false;
    try {
      if (want) {
        if (bannerCreated) await AdMob.resumeBanner();
        else {
          await AdMob.showBanner({ adId: ids.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: testing });
          bannerCreated = true;
        }
      } else {
        await AdMob.hideBanner();
        document.documentElement.style.setProperty('--banner-h', '0px');
      }
      bannerOn = want;
    } catch (e) {
      // 読み込めなくてもゲームは続ける。すぐに出し直すと失敗のたびに広告をリクエストし続けるので、少し待つ
      if (!want) bannerOn = false;
      failed = true;
    } finally {
      bannerBusy = false;
    }
    if (failed) {
      clearTimeout(bannerRetry);
      bannerRetry = setTimeout(syncBanner, RETRY_MS);
    } else if ((bannerWanted && !showing) !== bannerOn) {
      syncBanner(); // 処理中に表示したい状態が変わった
    }
  }
  function setBanner(visible) {
    bannerWanted = !!visible;
    syncBanner();
  }

  // 全画面広告を表示し、閉じられたら resolve する（読み込めていないときは出さずにすぐ resolve）
  function showInterstitial() {
    if (!hasFullscreen || !ready || !slots.inter.loaded || showing) return Promise.resolve();
    if (Date.now() - lastInterstitial < INTERSTITIAL_GAP_MS) return Promise.resolve();
    lastInterstitial = Date.now();
    showing = true;
    syncBanner();
    slots.inter.loaded = false;
    GameAudio.suspend();
    return new Promise((resolve) => {
      waiters.inter = () => { prepare('inter'); resolve(); };
      AdMob.showInterstitial().catch(() => finish('inter'));
    });
  }

  // リワード広告を表示する。結果は 'rewarded'（最後まで見た）/ 'skipped'（途中で閉じた）/ 'unavailable'（読み込めなかった）
  async function showRewarded() {
    if (!hasFullscreen || showing) return 'unavailable';
    await initDone;
    if (!ready || !(await ensureLoaded('reward', 8000))) return 'unavailable';
    showing = true;
    syncBanner();
    slots.reward.loaded = false;
    GameAudio.suspend();
    return new Promise((resolve) => {
      waiters.reward = (ok) => { prepare('reward'); resolve(ok ? 'rewarded' : 'skipped'); };
      AdMob.showRewardVideoAd().catch(() => finish('reward', false));
    });
  }

  // 同意した内容をあとから変更するための Google のフォームを開く
  function showPrivacyOptions() {
    if (!AdMob) return Promise.resolve();
    return AdMob.showPrivacyOptionsForm().catch(() => {});
  }

  const initDone = AdMob ? init() : Promise.resolve();

  return {
    // 全画面・リワード広告が使えるか（Android アプリで、広告ユニット ID があるとき）
    get available() { return hasFullscreen; },
    setBanner,
    get showing() { return showing; },
    get privacyOptionsRequired() { return privacyRequired; },
    initDone,
    showInterstitial,
    showRewarded,
    showPrivacyOptions,
  };
})();
