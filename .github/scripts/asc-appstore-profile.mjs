// App Store 配布用のプロビジョニングプロファイルを App Store Connect API で作り直し、この Mac に入れる。
// Xcode の自動署名（-allowProvisioningUpdates）は、まっさらな GitHub の Mac では実行のたびに開発用の証明書を作り、
// 上限に達すると Archive が失敗する。そこで、登録済みの配布用証明書だけで署名する（手動署名）。
//
// 環境変数：ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH（.p8 のパス）/ BUNDLE_ID / PROFILE_NAME
// 出力：GITHUB_ENV に PROFILE_NAME と PROFILE_UUID を書く
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, BUNDLE_ID, PROFILE_NAME, GITHUB_ENV } = process.env;
const API = 'https://api.appstoreconnect.apple.com/v1';

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' });
  const body = b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), {
    key: fs.readFileSync(ASC_KEY_PATH, 'utf8'),
    dsaEncoding: 'ieee-p1363',
  });
  return `${head}.${body}.${sig.toString('base64url')}`;
}

async function api(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Bundle ID（filter は前方一致なので、完全一致のものを選ぶ）
const bundles = await api('GET', `/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=200`);
const bundle = bundles.data.find((b) => b.attributes.identifier === BUNDLE_ID);
if (!bundle) throw new Error(`Bundle ID ${BUNDLE_ID} が App Store Connect に見つかりません`);

// 登録済みの配布用証明書（新しく作らない）
const certs = await api('GET', '/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=200');
const valid = certs.data.filter((c) => new Date(c.attributes.expirationDate) > new Date());
if (!valid.length) throw new Error('有効な配布用証明書（Apple Distribution）がありません');

// 同じ名前の古いプロファイルを消してから作り直す（証明書の入れ替えにも追従する）
const old = await api('GET', `/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&limit=200`);
for (const p of old.data.filter((p) => p.attributes.name === PROFILE_NAME)) await api('DELETE', `/profiles/${p.id}`);

const created = await api('POST', '/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: valid.map((c) => ({ type: 'certificates', id: c.id })) },
    },
  },
});
const { uuid, profileContent } = created.data.attributes;

// Xcode 16 以降と以前の、両方の置き場所に入れる
const home = os.homedir();
for (const dir of [
  path.join(home, 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
  path.join(home, 'Library/MobileDevice/Provisioning Profiles'),
]) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${uuid}.mobileprovision`), Buffer.from(profileContent, 'base64'));
}
if (GITHUB_ENV) fs.appendFileSync(GITHUB_ENV, `PROFILE_NAME=${PROFILE_NAME}\nPROFILE_UUID=${uuid}\n`);
console.log(`profile "${PROFILE_NAME}" (${uuid}) を作成しました（配布用証明書 ${valid.length} 件）`);
