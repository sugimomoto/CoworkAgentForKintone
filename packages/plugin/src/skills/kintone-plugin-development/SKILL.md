---
name: kintone-plugin-development
description: kintone Plugin (kintone のアプリ単位で適用される独立配布パッケージ) の開発・パッケージング・デプロイの定石集。manifest.json の書き方、PLUGIN_ID 取得イディオム、setProxyConfig で API トークン秘匿、設定画面 (config.html / config.js) の作り方、.ppk 秘密鍵の生成・管理、cli-kintone plugin pack / upload / keygen、トラブルシューティングが必要なときに参照する。
---

# kintone Plugin Development

kintone Plugin は **kintone アプリの上に「機能」を独立配布する単位**。1 つの zip にまとめて配布し、kintone 管理画面から「読み込む」操作でインストールできる。Plugin 開発者は manifest.json + js/css/html + アイコン を組み合わせて zip を作る。

## 全体フロー

```
ソース準備 (js / css / html / icon / manifest.json)
   ↓
パッケージング (cli-kintone plugin pack で zip 化、署名済)
   ↓
kintone へアップロード (UI: 管理 → プラグイン → 読み込む / CLI: plugin upload)
   ↓
アプリに適用 (admin が個別アプリで有効化)
   ↓
plugin_id (PLUGIN_ID) が **アプリ単位** で払い出される
```

**重要**: Plugin ID は plugin.zip の **秘密鍵 (.ppk)** から決まる。同じ .ppk で再パッケージング → 既存 plugin の更新扱い。違う .ppk → 別 plugin 扱い (= 設定が引き継がれない)。

## ディレクトリ構成 (標準)

```
my-plugin/
├── manifest.json              # 必須
├── image/
│   └── icon.png               # 必須 (アイコン)
├── js/
│   ├── desktop.js             # PC レコード画面用
│   ├── mobile.js              # モバイル用 (任意)
│   └── config.js              # 設定画面用
├── css/
│   ├── desktop.css            # PC 用 (任意)
│   └── config.css             # 設定画面用 (任意)
└── html/
    └── config.html            # 設定画面 HTML (任意、64KB 上限!)
```

**サイズ制限**:

| ファイル | 上限 |
|---|---|
| アイコン | 20MB |
| desktop.js / mobile.js / config.js (各) | 20MB |
| desktop.css / mobile.css / config.css | 20MB |
| **config.html** | **64KB** (← 一番厳しい) |
| 総ファイルサイズ | 100MB |

## manifest.json の最小例

```json
{
  "manifest_version": 1,
  "version": 1,
  "type": "APP",
  "name": {
    "ja": "問合せ通知プラグイン",
    "en": "Inquiry Notify Plugin"
  },
  "description": {
    "ja": "新規問合せをチャットに通知",
    "en": "Notify new inquiries to chat"
  },
  "icon": "image/icon.png",
  "homepage_url": {
    "ja": "https://example.com/plugins/inquiry-notify"
  },
  "desktop": {
    "js": ["js/desktop.js"],
    "css": ["css/desktop.css"]
  },
  "mobile": {
    "js": ["js/mobile.js"]
  },
  "config": {
    "html": "html/config.html",
    "js": ["js/config.js"],
    "css": ["css/config.css"],
    "required_params": ["webhookUrl", "channel"]
  }
}
```

ポイント:

- `version` は **数値で単調増加** 必須 (kintone が「更新あり」を判定)。既存より小さい値で upload するとエラー
- `name.en` は必須。`name.ja` は推奨
- `description.en` も書くなら必須 (片方だけ書くと validation エラー)
- 対応ロケール: `ja` / `en` (必須) / `zh` / `zh-TW` / `es` / `pt-BR` / `th`
- `config.required_params` を書くと **管理者がその項目を未入力のまま保存すると警告** が出る
- `external_urls` を書くと kintone が `setProxyConfig` 等で外部 URL を許可する (近年は使わないケース多い)

## PLUGIN_ID の正しい取得 (重要イディオム)

複数 plugin が共存するとき、kintone 側のグローバル `kintone.$PLUGIN_ID` が **意図しない値を返すことがある** (他 plugin のコード実行中だと書き換わる)。**即時実行関数で固定化**するのが定石:

```js
((PLUGIN_ID) => {
  // ★ この closure 内では PLUGIN_ID が固定される
  kintone.events.on('app.record.index.show', (event) => {
    const config = kintone.plugin.app.getConfig(PLUGIN_ID);
    console.log('plugin config:', config);
    return event;
  });
})(kintone.$PLUGIN_ID);
```

すべての desktop.js / mobile.js / config.js でこのパターンを使う。

## 設定画面 (config.html + config.js)

### config.html (64KB 上限!)

```html
<!doctype html>
<section class="settings">
  <h2>Webhook 通知設定</h2>

  <label>Webhook URL</label>
  <input type="text" id="webhook-url" />

  <label>通知チャンネル</label>
  <input type="text" id="channel" />

  <label>API Token</label>
  <input type="password" id="api-token" />
  <p class="hint">トークンは setProxyConfig 経由で安全に保管されます</p>

  <button id="save">保存</button>
  <button id="cancel">キャンセル</button>
</section>
```

### config.js (必須パターン)

```js
((PLUGIN_ID) => {
  // 1. 既存設定の復元 (= 再表示時にデフォルトに戻らないようにする)
  document.addEventListener('DOMContentLoaded', () => {
    const conf = kintone.plugin.app.getConfig(PLUGIN_ID);
    if (conf.webhookUrl) document.getElementById('webhook-url').value = conf.webhookUrl;
    if (conf.channel)    document.getElementById('channel').value    = conf.channel;
    // ★ API Token は getConfig から取れない (setProxyConfig 側にしか保管しないため)
    //    既存有無は別途 sentinel フラグ (例: conf.saved) で判定する
  });

  // 2. 保存
  document.getElementById('save').addEventListener('click', () => {
    const webhookUrl = document.getElementById('webhook-url').value;
    const channel    = document.getElementById('channel').value;
    const apiToken   = document.getElementById('api-token').value;

    // 公開可能な値だけ setConfig (kintone DB に平文保存される)
    kintone.plugin.app.setConfig(
      { webhookUrl, channel, saved: 'true' },
      () => {
        // 保存後のリダイレクト (kintone が自動でやる場合は不要)
        window.location.href = '../../flow?app=' + kintone.app.getId();
      }
    );

    // Secret 値は setProxyConfig 経由でヘッダー固定化 (kintone runtime が
    // proxy 呼出時に自動付与する。JS 側からは取り出せない)
    if (apiToken) {
      kintone.plugin.app.setProxyConfig(
        'https://slack.com/api/chat.postMessage',
        'POST',
        { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        {}
      );
    }
  });

  // 3. キャンセル
  document.getElementById('cancel').addEventListener('click', () => {
    history.back();
  });
})(kintone.$PLUGIN_ID);
```

**重要 (秘匿情報の扱い)**:

| 種別 | 保存先 | 取出可否 |
|---|---|---|
| 公開可能値 (webhook URL / フィールドコード等) | `setConfig` (kintone DB) | `getConfig` で取得可 |
| 秘匿値 (API Token / Secret) | `setProxyConfig` 固定ヘッダ | **取出不可** (kintone runtime のみが proxy 呼出時に付与) |
| 秘匿値の存在確認 | `setConfig({saved: 'true'})` 等の sentinel フラグ | sentinel で判定 |

→ **secret を `setConfig` に保存してはいけない**。kintone DB に平文で残り、admin 画面からは見えないが、`getConfig` で誰でも読める。

## desktop.js から外部 API を叩く (`kintone.plugin.app.proxy`)

```js
((PLUGIN_ID) => {
  kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], async (event) => {
    const body = {
      channel: '#inquiries',
      text: `新規問合せ: ${event.record['title'].value}`
    };

    try {
      const [respBody, status] = await new Promise((resolve, reject) => {
        kintone.plugin.app.proxy(
          PLUGIN_ID,
          'https://slack.com/api/chat.postMessage',
          'POST',
          {},                          // ヘッダは setProxyConfig 由来
          JSON.stringify(body),
          (b, s, h) => resolve([b, s]),
          (e) => reject(e)
        );
      });
      console.log(status, respBody);
    } catch (err) {
      console.error(err);
    }
    return event;
  });
})(kintone.$PLUGIN_ID);
```

**proxy 適用条件 (4 つすべて一致したときのみ固定ヘッダが付与される)**:
1. Plugin ID
2. URL (前方一致)
3. HTTP メソッド
4. アプリ

→ `setProxyConfig` で `'POST' https://...'` を登録したら、`proxy()` 呼出時も同じ `(POST, URL prefix)` で叩く必要がある。

## cli-kintone でのビルド・配布

`cli-kintone` (kintone 公式 CLI) が現在の推奨。`create-plugin` / `plugin-packer` / `plugin-uploader` は 2026/8 でメンテ終了予定。

### 秘密鍵 (.ppk) の生成 (初回のみ)

```bash
mkdir -p .keys
cli-kintone plugin keygen --output .keys/plugin.ppk
```

**重要**: `.ppk` は **plugin ID を一意に決める** ので絶対紛失しないこと。失うと **同じ plugin として更新できなくなる** (新 plugin 扱いになり既存アプリの設定が引き継がれない)。`.gitignore` 必須 + チーム共有なら 1Password / Secrets Manager に保管。

### パッケージング

```bash
cli-kintone plugin pack \
  --input plugin/manifest.json \
  --private-key .keys/plugin.ppk \
  --output dist/plugin.zip
```

manifest.json があるディレクトリの **隣接ファイル** (image / js / css / html) が一緒に zip 化される。

### kintone へアップロード

```bash
# .env 例:
# KINTONE_BASE_URL=https://tenant.cybozu.com
# KINTONE_USERNAME=admin
# KINTONE_PASSWORD=secret

cli-kintone plugin upload \
  --base-url $KINTONE_BASE_URL \
  --username $KINTONE_USERNAME \
  --password $KINTONE_PASSWORD \
  --file-path dist/plugin.zip
```

- 既存 plugin (同 plugin_id = 同 .ppk) なら **更新 install**
- 同 plugin_id で `version` を上げて再 upload すると **適用済みアプリすべてに即座に反映**

### package.json の typical scripts

```json
{
  "scripts": {
    "keygen":  "cli-kintone plugin keygen --output .keys/plugin.ppk",
    "pack":    "cli-kintone plugin pack --input plugin/manifest.json --private-key .keys/plugin.ppk --output dist/plugin.zip",
    "upload":  "node --env-file=.env scripts/upload.mjs",
    "deploy":  "pnpm pack && pnpm upload"
  }
}
```

## webpack / esbuild との統合

ソースを TS / React で書くなら、ビルド成果物を `plugin/js/desktop.js` 等に出力する形にする:

```bash
# esbuild 例
esbuild src/desktop/index.ts \
  --bundle --format=iife --target=es2020 --minify \
  --outfile=plugin/js/desktop.js
```

ビルド後に `cli-kintone plugin pack` を回す。

`webpack-plugin-kintone-plugin` を使うと、ビルド + pack を 1 ステップに統合できる (継続メンテ中)。

## よくあるつまずき

| つまずき | 対処 |
|---|---|
| **設定画面で値が再表示されない** | `DOMContentLoaded` で `getConfig` → フォームに反映するロジックが必要 |
| **secret が平文で残ってしまう** | `setConfig` ではなく `setProxyConfig` を使う |
| **proxy 呼出に固定ヘッダがつかない** | URL prefix / method / pluginId / app が `setProxyConfig` 登録と完全一致しているか確認 |
| **`kintone.$PLUGIN_ID` が他 plugin の ID を返す** | 即時実行関数で固定化 (上記イディオム) |
| **manifest.json validation 失敗** | `name.en` / `manifest_version: 1` 必須、`version` 単調増加、`description` 書くなら `description.en` 必須 |
| **config.html が 64KB を超える** | UI ライブラリは外部 JS で読み込む / 大きい説明は別ページへリンク |
| **PLUGIN_ID をハードコードしてしまう** | `kintone.$PLUGIN_ID` を即時実行関数で受け、closure で固定 |
| **アイコン形式エラー** | PNG / JPG / GIF / BMP のいずれか。SVG 不可 |
| **.ppk を git に入れた** | 即座に rotate。新 .ppk で plugin を作り直し、旧 ID は廃止 |
| **モバイル対応忘れ** | `manifest.json` の `mobile.js` 配列 + `mobile.app.record.*` イベントで両対応 |
| **CORS エラー (proxy 経由なのに発生)** | desktop で `fetch()` を直接使っている。`kintone.plugin.app.proxy()` に置換 |

## REST API でフィールド / ビュー追加 (高度な用途)

`/k/v1/preview/app/...` (preview 環境) で変更 → `/k/v1/preview/app/deploy.json` で本番反映、の 2 段階。

```js
// フィールド追加
await kintone.api(
  kintone.api.url('/k/v1/preview/app/form/fields', true),
  'POST',
  {
    app: kintone.app.getId(),
    properties: {
      myPluginField: {
        type: 'SINGLE_LINE_TEXT',
        code: 'myPluginField',
        label: 'プラグイン管理用'
      }
    }
  }
);

// deploy
await kintone.api(
  kintone.api.url('/k/v1/preview/app/deploy', true),
  'POST',
  { apps: [{ app: kintone.app.getId() }] }
);
```

## .gitignore (テンプレ)

```
.keys/
*.ppk
dist/
plugin/js/*.bundle.js
node_modules/
.env
```

## まとめ

1. **`.ppk` を 1 度だけ生成して大切に保管** (plugin ID が決まる)
2. **manifest.json の `version` を単調増加**で更新
3. **PLUGIN_ID は即時実行関数で closure 固定**
4. **secret は `setProxyConfig`、公開値は `setConfig`** で分離
5. **設定画面は `DOMContentLoaded` で既存値復元**
6. **`cli-kintone plugin pack` + `upload`** で配布
7. **proxy 呼出は URL prefix / method / pluginId / app の 4 つが完全一致したときだけ固定ヘッダが乗る**

`kintone-customize-js` skill が「アプリ単位カスタマイズ」、本 skill は「再配布可能な Plugin パッケージ」を扱う。両者を組み合わせると、特定アプリ専用カスタマイズ → 汎用 Plugin への昇格パスがクリア。
