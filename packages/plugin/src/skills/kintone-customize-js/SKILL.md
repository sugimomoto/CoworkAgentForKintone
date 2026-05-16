---
name: kintone-customize-js
description: kintone の JavaScript カスタマイズ (kintone.events.on / kintone.app.record / kintone.api 等) を書くときの定石・落とし穴・コード断片集。フィールドコード参照、イベントハンドラ、表示制御、Promise 非同期処理、PC/モバイル切替、REST API 呼出のパターンが必要なときに参照する。
---

# kintone Customize JS

kintone のレコード画面 / 一覧画面で動く JavaScript カスタマイズを書くときの定石をまとめた skill。レコードハンドラの登録、フィールド値の参照と書換え、表示制御、REST API 呼出、PC/モバイル切替の各パターンを網羅する。

## 全体メンタルモデル

- **イベント駆動**: `kintone.events.on(<type>, <handler>)` で画面遷移・値変更・保存タイミングに介入する
- **handler は同期/非同期どちらでも OK**。非同期処理 (REST API 呼出等) を待ちたいときは **`Promise` を return** する
- **handler は必ず `event` (またはモディファイ後の event) を return する** — return しないと書換えが反映されない / 保存が canceled になる
- **`false` を return** すると保存・削除・アクション実行をキャンセル

## イベントタイプ命名規則

PC とモバイルで別タイプ。両対応するときは配列で指定:

```js
kintone.events.on(['app.record.create.show', 'mobile.app.record.create.show'], (event) => {
  // PC でもモバイルでも同じ処理
  return event;
});
```

主要イベント:

| 画面 | PC | モバイル |
|---|---|---|
| 一覧表示 | `app.record.index.show` | `mobile.app.record.index.show` |
| 一覧インライン編集 (change) | `app.record.index.edit.change.<フィールドコード>` | — (PC のみ) |
| 一覧インライン編集 (submit) | `app.record.index.edit.submit` | — |
| 一覧から削除 | `app.record.index.delete.submit` | — |
| 詳細画面表示 | `app.record.detail.show` | `mobile.app.record.detail.show` |
| プロセス管理アクション | `app.record.detail.process.proceed` | `mobile.app.record.detail.process.proceed` |
| 追加画面表示 | `app.record.create.show` | `mobile.app.record.create.show` |
| 追加画面 (値変更) | `app.record.create.change.<フィールドコード>` | `mobile.app.record.create.change.<フィールドコード>` |
| 追加保存 (pre) | `app.record.create.submit` | `mobile.app.record.create.submit` |
| 追加保存 (success) | `app.record.create.submit.success` | `mobile.app.record.create.submit.success` |
| 編集画面表示 | `app.record.edit.show` | `mobile.app.record.edit.show` |
| 編集画面 (値変更) | `app.record.edit.change.<フィールドコード>` | `mobile.app.record.edit.change.<フィールドコード>` |
| 編集保存 (pre) | `app.record.edit.submit` | `mobile.app.record.edit.submit` |
| 編集保存 (success) | `app.record.edit.submit.success` | `mobile.app.record.edit.submit.success` |
| ポータル | `portal.show` | `mobile.portal.show` |
| グラフ | `app.report.show` | — |
| 印刷 | `app.record.print.show` | — |

## レコード値の参照と書換え

### `event.record` を直接書換える (handler 内で必須)

```js
kintone.events.on('app.record.edit.show', (event) => {
  const record = event.record;
  // 値を読む
  const title = record['title'].value;            // SINGLE_LINE_TEXT
  const price = Number(record['price'].value);    // NUMBER (文字列で来るので変換)
  const status = record['status_dropdown'].value; // DROP_DOWN
  const tags = record['categories'].value;        // CHECK_BOX (string[])
  const ts = record['expected_at'].value;         // DATETIME (ISO8601 string)

  // 値を書き換える
  record['title'].value = '(下書き) ' + title;
  record['categories'].value = ['新規', '優先'];   // CHECK_BOX は配列
  record['expected_at'].value = '2026-12-31T15:00:00Z';

  return event; // ★ 必ず return
});
```

### handler の外で取得・設定 (`kintone.app.record.get/set`)

`kintone.events.on` の handler 内では使えない。`setTimeout` / ボタン onclick 等の handler 外コンテキストから使う:

```js
// PC
const record = kintone.app.record.get().record;
record['memo'].value = '外部処理で書込';
kintone.app.record.set({ record });

// モバイル
const recordM = kintone.mobile.app.record.get().record;
```

## フィールド型別の値形式 (頻出)

| フィールド型 | `value` の型 |
|---|---|
| SINGLE_LINE_TEXT / MULTI_LINE_TEXT / RICH_TEXT / LINK | string |
| NUMBER / CALC | string (数値文字列) |
| RADIO_BUTTON / DROP_DOWN / STATUS / RECORD_NUMBER | string |
| CHECK_BOX / MULTI_SELECT / CATEGORY | string[] |
| USER_SELECT / ORGANIZATION_SELECT / GROUP_SELECT | `{code: string, name: string}[]` |
| DATE | string (`YYYY-MM-DD`) |
| TIME | string (`HH:mm`) |
| DATETIME / CREATED_TIME / UPDATED_TIME | string (ISO 8601) |
| FILE (添付ファイル) | `{contentType, fileKey, name, size}[]` (read only in handler) |
| SUBTABLE | `{id, value: {<innerFieldCode>: {type, value}, ...}}[]` |
| 作成者 / 更新者 | `{code, name}` |

書込時は **必ず文字列**。NUMBER に `123` (数値) を入れると失敗する。`String(123)` で渡す。

## 表示制御 (背景色変更 / フィールド hide-show)

### フィールドのスタイル変更 (`setFieldStyle`)

```js
kintone.events.on(['app.record.detail.show', 'app.record.edit.show'], async (event) => {
  if (event.record['status'].value === '完了') {
    await kintone.app.record.setFieldStyle('status', {
      background: { backgroundColor: '#86efac' },        // 緑
      content: { color: '#064e3b', fontWeight: 'bold' },
      label:   { color: '#064e3b', fontWeight: 'bold' }
    });
  }
  return event;
});
```

- 戻り値は Promise。`await` する
- `'DEFAULT'` を渡すと解除: `await kintone.app.record.setFieldStyle('status', 'DEFAULT')`
- 利用画面: 詳細 / 追加 / 編集 / 印刷 (PC + モバイル両方)

### フィールド表示/非表示

```js
// PC
kintone.app.record.setFieldShown('amount', false);     // 非表示
kintone.app.record.setFieldShown('amount', true);      // 表示

// モバイル
kintone.mobile.app.record.setFieldShown('amount', false);
```

- 利用画面: 詳細 / 追加 / 編集 / 印刷
- 存在しない fieldCode を渡してもエラーにはならない (silent fail)

### 行スタイル (一覧画面)

`app.record.index.show` 内で DOM 直接操作:

```js
kintone.events.on('app.record.index.show', (event) => {
  event.records.forEach((rec, i) => {
    if (rec['status'].value === '完了') {
      // 行 DOM は kintone.app.getFieldElements や querySelector 経由
      // ※ 公式 API では行スタイル直接 API は無いので注意
    }
  });
  return event;
});
```

## 非同期処理 (REST API 呼出)

`kintone.api()` は Promise を返す。handler 内で **Promise を return すれば完了を待ってから次の処理に進む**:

```js
kintone.events.on('app.record.edit.submit', async (event) => {
  const refAppId = 100;
  const customerCode = event.record['customer_code'].value;
  const resp = await kintone.api(
    kintone.api.url('/k/v1/records', true),
    'GET',
    { app: refAppId, query: `code = "${customerCode}"` }
  );
  if (resp.records.length === 0) {
    event.error = '顧客マスタに該当レコードがありません';
    return event;     // error メッセージで保存キャンセル
  }
  event.record['customer_name'].value = resp.records[0].name.value;
  return event;
});
```

### 大量データ (>500 件)

`/k/v1/records.json` は 1 リクエスト最大 500 件、`offset` 上限 10000。10000 を超える件数は **cursor API** か **`$id > <last_id>`** で進める:

```js
// $id ベースのページング (offset 不要)
async function fetchAll(appId, queryBase) {
  let all = [];
  let lastId = 0;
  while (true) {
    const q = `${queryBase} and $id > ${lastId} order by $id asc limit 500`;
    const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', { app: appId, query: q });
    if (resp.records.length === 0) break;
    all = all.concat(resp.records);
    lastId = Number(resp.records[resp.records.length - 1].$id.value);
  }
  return all;
}
```

## バリデーション (保存前にチェック)

```js
kintone.events.on(['app.record.create.submit', 'app.record.edit.submit'], (event) => {
  const r = event.record;
  // フィールド単位エラー
  if (!r['title'].value) {
    r['title'].error = 'タイトルは必須です';
  }
  // 画面上部エラー (全体)
  if (Number(r['amount'].value) > 1_000_000) {
    event.error = '金額が上限を超えています';
  }
  return event;
});
```

- `record[<field>].error` でフィールド単位
- `event.error` で画面上部
- どちらか 1 つ以上 set されると保存キャンセル

## PC / モバイル切替

```js
if (kintone.app.isMobilePage()) {
  // モバイル用処理
} else {
  // PC 用処理
}
```

または handler 自体を分ける:

```js
const handler = (event) => { /* ... */ };
kintone.events.on('app.record.create.show', handler);
kintone.events.on('mobile.app.record.create.show', handler);
```

## 確認ダイアログ / 通知

```js
// 確認ダイアログ (Promise)
const ok = await kintone.app.showConfirmDialog({
  title: '削除しますか?',
  body: '元に戻せません',
  confirmText: '削除',
  cancelText: 'キャンセル'
});
if (!ok) return event;

// 画面上部通知
kintone.app.showNotification('処理が完了しました', { type: 'success' }); // success / warning / error
```

## ログインユーザー / アプリ情報

```js
const me = kintone.getLoginUser();      // {id, code, name, email, language, timezone, ...}
const isAdmin = kintone.getLoginUser().administrator;
const appId = kintone.app.getId();      // number (詳細 / 編集画面で利用可)
const queryUrl = kintone.app.getQueryCondition();  // 一覧画面の絞り込みクエリ
```

## プラグインから外部 API を叩く

カスタマイズファイルから直接 `kintone.proxy()` を使うか、Plugin Config で proxy 登録した URL を `kintone.plugin.app.proxy(<pluginId>, ...)` で叩く。Plugin 開発時は **`kintone.plugin.app.proxy`** が標準:

```js
const [body, status] = await kintone.plugin.app.proxy(
  PLUGIN_ID, // ビルド時に置換 (cli-kintone or build script で埋込)
  'https://api.example.com/endpoint',
  'POST',
  { 'Content-Type': 'application/json' },
  JSON.stringify({ payload: 'value' })
);
```

## よくある落とし穴

| 落とし穴 | 対処 |
|---|---|
| **handler 末尾に `return event` 忘れ** | 値書換え / バリデーションエラーが反映されない |
| **NUMBER フィールドに数値 (非文字列) を代入** | `String(123)` で文字列化必須 |
| **`event.record` を直接書換えず `kintone.app.record.set()` を handler 内で呼ぶ** | 効かない。handler 内では event.record を変更して return |
| **モバイル対応忘れ** | `mobile.app.record.*` を別 type で登録 (or 配列で同時) |
| **存在しないフィールドコードを参照** | `record['nope']` は undefined。先にスキーマを `kintone-get-form-fields` で確認 |
| **CHECK_BOX に string で代入** | 配列で渡す: `['A', 'B']` |
| **submit イベントで `await` するとフリーズ** | Promise を return する形式に変更 (`async (event) => {...; return event}`) |
| **`event.records` (s 複数) vs `event.record`** | 一覧系は `records`、詳細/追加/編集は `record` |
| **handler 二重登録** | 同 type に 2 度 `on` すると両方実行される。配列順は登録順 |
| **PLUGIN_ID 即値ハードコード** | plugin-packer / cli-kintone がビルド時に置換するので `__PLUGIN_ID__` トークン or `kintone.$PLUGIN_ID` を使う |

## デバッグ Tips

- `console.log(event)` で構造をまず確認
- `JSON.stringify(event.record, null, 2)` でフィールド構造一覧
- `kintone.api` 失敗時は `error.message` / `error.code` (kintone API エラーコード) を確認
- 開発時は kintone の「動作テスト環境」(管理者のみ参照) でテスト → 本番反映

## まとめ

1. **`kintone.events.on(type, handler)` で介入し、必ず `event` を return**
2. **値型は SINGLE_LINE_TEXT / NUMBER (文字列!) / CHECK_BOX (配列) / DATETIME (ISO 8601) を間違えない**
3. **非同期は `async` + `Promise` return**
4. **PC/モバイル両対応するなら type を配列で並べる**
5. **背景色 / 表示制御は `setFieldStyle` / `setFieldShown`**
6. **REST API は `kintone.api(kintone.api.url('/k/v1/...', true), 'GET'|'POST'|...)` で Promise を返す**

具体的なフィールド構造に依存する処理を書くときは、先に `kintone-get-form-fields` でアプリのスキーマを確認するのが鉄則。
