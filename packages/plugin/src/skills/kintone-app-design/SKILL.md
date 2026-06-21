---
name: kintone-app-design
description: REST API / 管理系ツール (kintone-create-app / add-form-fields / update-form-layout / update-views / update-process-management / update-app-acl / deploy-app 等) で kintone アプリの構造そのものを設計・構築するときの定石・落とし穴集。特に計算フィールドの式と表示形式 (CONVERT! / #DIV/0! エラー、DATE_FORMAT が文字列を返す問題、日付の加算)、フィールド種別ごとの JSON 形状、フォームレイアウト、一覧ビュー、プロセス管理、権限、preview→deploy の流れで迷うときに参照する。JavaScript カスタマイズ (kintone-customize-js) やプラグイン開発 (kintone-plugin-development) は別スキル。
---

# kintone アプリ設計スキル

REST API / 管理系ツールで kintone アプリの「箱」(フィールド・フォーム・一覧・プロセス管理・権限) を
設計・構築するときの定石をまとめた skill。**計算フィールドの落とし穴** (今もっとも事故が多い) を核心に、
全置換セマンティクスと preview→deploy の流れ、フィールド設計の早見表を扱う。

各ツールの引数仕様そのものは各ツールの description が一次情報。本スキルはそれらを**横断する手続き**と、
ツール description には書ききれない**深い落とし穴**を補う。

## 1. メンタルモデル (これだけは常に意識)

- **更新系は「全置換」**: `update-views` / `update-form-layout` / `update-process-management` /
  `update-app-acl` / `update-app-plugins` は送った内容で**設定全体を置き換える**。一部だけ送ると残りが消える。
  必ず対応する `get-*` で現状を取得し、**残したいものも含めて全体を送る** (自動作成の「（作業者が自分）」
  ビュー等も保持)。
- **変更は preview に積まれる**: 管理系の更新は運用前 (preview) 環境に書かれ、**`kintone-deploy-app` を
  実行するまで本番に反映されない**。deploy 後は `kintone-get-app-deploy-status` で `SUCCESS` を確認する。
- **フィールド追加とレイアウト配置は別操作**: `add-form-fields` で定義を追加しても、フォーム上には並ばない。
  `get-form-layout` → 既存レイアウトに新フィールドの行を挿入 → `update-form-layout` で配置する。
- **計算フィールド・フィールド設計の細かい落とし穴は本スキルの 2〜4 章を参照する**。

## 2. 計算フィールド (CALC) 完全リファレンス ★最重要

計算フィールドのエラー (`CONVERT!` / `#DIV/0!`) は、式が返す**型**と、フィールドの**表示形式**の
ミスマッチで起きる。ここを外すと何度も試行錯誤する。

### 2.1 表示形式 (format) は数値・日時系のみ。文字列形式は無い

CALC フィールドの `format` は次の 7 種だけ。**「文字列」の表示形式は存在しない**:

| format | 表示例 | 値の型 |
|---|---|---|
| `NUMBER` | 1000 | 数値 |
| `NUMBER_DIGIT` | 1,000 | 数値 (3桁区切り) |
| `DATETIME` | 2026-08-06 2:03 | 日時 |
| `DATE` | 2026-08-06 | 日付 |
| `TIME` | 2:03 | 時刻 |
| `HOUR_MINUTE` | 26時間3分 | 時間 |
| `DAY_HOUR_MINUTE` | 1日2時間3分 | 時間 |

`format` 省略時の既定は `NUMBER`。

### 2.2 関数インベントリと戻り型 (これがエラーの源)

計算式で使える関数は有限。**何を返すか (数値 / 文字列 / 真偽)** を必ず意識する:

| 関数 / 演算子 | 戻り型 | 用途 |
|---|---|---|
| `+` `-` `*` `/` | 数値 | 四則演算 |
| `SUM(...)` | 数値 | 合計 |
| `ROUND` / `ROUNDUP` / `ROUNDDOWN` | 数値 | 四捨五入 / 切上 / 切捨 |
| `YEN(...)` | 数値 | 円表示 (3桁区切り) |
| `IF(cond, a, b)` | a / b の型 | 条件分岐 |
| `AND` / `OR` / `NOT` / `CONTAINS` | 真偽 | 条件判定 (IF の中で使う) |
| **`DATE_FORMAT(数値, 書式, TZ)`** | **文字列** | 日時を指定書式の**文字列**に整形 |
| `&` | 文字列 | 文字列結合 |

### 2.3 CONVERT! の判断ルール

> **式が文字列を返すのに、CALC には文字列の表示形式が無い → どの format でも変換できず `CONVERT!`**

- `DATE_FORMAT(...)` や `"foo" & 値` は**文字列**を返す。これを CALC フィールドに入れると、format が
  NUMBER でも DATE でも変換できず **`CONVERT!`** になる。
- つまり **CALC フィールドで `DATE_FORMAT` を使ってはいけない** (結果が文字列のため表示不能)。

### 2.4 日付計算の正しいレシピ

日付フィールドを式の算術に使うと、**UNIX 時間 (1970-01-01 からの秒数, 数値)** に変換される。
日付・時刻フィールドは内部的に **UTC ("Etc/GMT") 固定**。これを使う:

**「N 日後」= 日付 + 日数 × 86400 を、format=DATE で表示する** (DATE_FORMAT は使わない):

```
expression: invoice_date + due_days * 24 * 60 * 60
format:     "DATE"
```

- `invoice_date` (DATE/DATETIME) は秒数に変換され、`due_days * 86400` (日数→秒) を足すと有効な UNIX 秒。
- `format=DATE` にすると kintone がその数値を日付として描画する。タイムゾーン関数は不要。
- ❌ `DATE_FORMAT(invoice_date + due_days*86400, "YYYY-MM-dd", "Etc/GMT")` … 文字列を返すので **CONVERT!**
- ✅ 上記の数値計算 + `format=DATE`

時間差を「○時間○分」で出すなら `format=HOUR_MINUTE`、「○日○時間」なら `DAY_HOUR_MINUTE`。

> `DATE_FORMAT` は本来「文字列(1行)フィールドの自動計算」など**文字列を入れられる先**で使うもの。
> CALC フィールドの表示には使わない。

### 2.5 その他のエラー

- **`#DIV/0!`**: ゼロ除算。`IF(divisor = 0, 0, a / divisor)` でガードする。
- **小数**: `displayScale` で小数点以下桁数を指定。指定しないと整数表示になりうる。

## 3. 構築レシピ (順序と全置換の作法)

### 3.1 新規アプリを作る標準フロー

```
1. kintone-create-app                 アプリの器を作る (preview)
2. kintone-add-form-fields            フィールド定義を追加 (preview)
3. kintone-get-form-layout            現状レイアウトを取得
   → 新フィールドの ROW を挿入
   kintone-update-form-layout         レイアウト全体を PUT (preview)
4. kintone-update-views               一覧ビューを設定 (必要時、全置換)
5. kintone-update-process-management  プロセス管理 (必要時、全置換)
6. kintone-update-app-acl             権限 (必要時、全置換)
7. 差分を説明 → ユーザー承認
8. kintone-deploy-app                 本番反映 (承認カードが出る)
9. kintone-get-app-deploy-status      SUCCESS を確認して報告
```

### 3.2 既存アプリを変更するとき (全置換ツールの鉄則)

```
get-*  で現状取得  →  必要な差分だけマージ  →  update-* で「全体」を PUT
```

- ビュー: `get-views` の結果に新ビューを足して `update-views`。**消したくない既存ビューも必ず含める**。
- レイアウト: `get-form-layout` の配列に新フィールドの行を挿入して `update-form-layout`。
- プロセス管理 / ACL: `get-*` で states/actions/rights 全体を取得しマージして `update-*`。
- `revision` を渡すと楽観ロック (他者が同時更新していたら 409)。安全に上書きするなら直前に get した
  revision を渡す。

### 3.3 deploy のガード

- いきなり deploy しない。**preview 構築 → 差分説明 → ユーザー承認 → deploy** の順。
- `kintone-deploy-app` / `kintone-delete-form-fields` / `kintone-delete-records` は UI で承認カードが出る
  破壊的操作。実行前に影響を説明する。
- 取り消したいときは deploy-app の `revert` で preview の変更を破棄できる。

## 4. フィールド設計の早見表

### 4.1 予約フィールドコード (code に使えない)

`ステータス` / `作業者` / `カテゴリー` / `レコード番号` / `作成者` / `作成日時` / `更新者` / `更新日時`
(英: Status / Assignee / Categories / Record_number / Creator / Created_datetime / Modifier /
Updated_datetime)。プロセス管理のステータスは自動生成されるので、独自フィールドは別コード (例 `deal_status`)。

### 4.2 選択系フィールドの options 形状

`DROP_DOWN` / `RADIO_BUTTON` / `CHECK_BOX` / `MULTI_SELECT` は:

```json
"options": {
  "未対応": { "label": "未対応", "index": "0" },
  "対応中": { "label": "対応中", "index": "1" }
}
```

- key とラベルは一致させる。**`index` は文字列** ("0" 始まり、昇順)。
- 各フィールド定義に `type` は必須。

### 4.3 一覧の filterCond 演算子はフィールド型依存

| フィールド型 | 使える演算子 |
|---|---|
| 選択系 (DROP_DOWN/RADIO/CHECK_BOX/MULTI_SELECT)・ユーザー/組織/グループ・作成者・更新者 | `in` / `not in` のみ (`=`/`!=` 不可) |
| 文字列 (1行/複数行)・リンク | `like` / `not like` / `=` / `!=` |
| 数値・日付・日時・計算 | `=` `!=` `>` `<` `>=` `<=` |

### 4.4 設定が複雑なフィールド (要 get で形状確認)

- **ルックアップ (LOOKUP)**: `lookup.relatedApp.app` + `relatedKeyField` + `fieldMappings[]` が要。
- **関連レコード一覧 (REFERENCE_TABLE)**: `referenceTable.relatedApp` + `condition{field, relatedField}` +
  `displayFields[]`。値は持たない (登録更新不可)。
- **テーブル (SUBTABLE)**: `fields` に内部フィールドを入れ子で定義。
- 迷ったら参照先アプリで `kintone-get-form-fields` を実行して既存形状を確認してから組む。

## 5. エラー早見

| 症状 | 原因 | 対処 |
|---|---|---|
| 計算フィールドが `CONVERT!` | 式が文字列を返している (DATE_FORMAT 等) のに CALC は文字列表示形式が無い | DATE_FORMAT をやめ、数値計算 + `format=DATE` 等にする (2.4) |
| 計算フィールドが `#DIV/0!` | ゼロ除算 | `IF(divisor=0, 0, a/divisor)` |
| add-form-fields が 400 (`入力内容が正しくありません`) | 予約コード使用 / options の index が数値 / type 欠落 | 4.1・4.2 を確認。エラー詳細 (errors) のフィールドキーを見る |
| update-views で既存ビューが消えた | 全置換なのに一部だけ送った | get-views で全体取得してからマージ (3.2) |
| 変更が本番に出ない | preview に積まれただけ | `kintone-deploy-app` → `get-app-deploy-status` |
| 日付がずれて表示 | TZ の取り違え (内部は Etc/GMT) | 日付計算は秒数 + format=DATE。文字列整形が要るときのみ DATE_FORMAT に正しい TZ |

## まとめ

1. **更新系は全置換** — `get-*` → マージ → `update-*` で全体を送る
2. **変更は preview** — `deploy-app` → `get-app-deploy-status(SUCCESS)` まで本番に出ない
3. **計算フィールドで `DATE_FORMAT` を使わない** — 文字列を返し `CONVERT!` になる。日付加算は
   `date + days*86400` を `format=DATE` で
4. **予約コード・options の index 文字列・filterCond の型別演算子** を外さない
5. 複雑なフィールド (lookup/関連/テーブル) は先に `get-form-fields` で既存形状を確認してから組む
