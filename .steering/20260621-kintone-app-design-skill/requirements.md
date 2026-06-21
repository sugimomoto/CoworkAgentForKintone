# 要求定義: kintone アプリ構造設計スキル (`kintone-app-design`)

## 背景・課題

app-designer (#117) に計算フィールド付きアプリを作らせたところ、生成された式
`DATE_FORMAT(invoice_date + due_days * 24 * 60 * 60, "YYYY-MM-dd", "Etc/GMT")` が `CONVERT!` エラーに
なった。原因は「計算フィールドには文字列の表示形式が無い (数値/日時/日付/時刻/時間のみ) のに
`DATE_FORMAT` が文字列を返す」ため。正解は `DATE_FORMAT` を使わず `invoice_date + due_days * 86400`
を `format=DATE` で表示する数値計算パターン。

これは単発バグではなく、**kintone のアプリ構造設計に関するドメイン知識の不足**の一症状。同種の落とし穴
(フィールド種別ごとの JSON 形状、ルックアップ/関連レコード、テーブル、フォームレイアウト制約、ビュー種別、
プロセス管理設定、ACL、deploy フロー、予約コード) が多数ある。

これらを `APP_DESIGNER_DOMAIN_PROMPT` (システムプロンプト) に足し続けると、毎ターン全文ロードで常時
トークンを消費し、際限なく肥大化する。Custom Skills 基盤 (#30) は progressive disclosure (必要時のみ
本文をロード) なので、知識ベースを厚くしても常時コストがほぼ増えない。この用途の正しい器。

## 目的

kintone の**アプリ構造設計** (REST 経由のフィールド/フォーム/ビュー/プロセス管理/権限/deploy) の定石・
落とし穴をまとめた Custom Skill `kintone-app-design` を新設し、app-designer の知識基盤を
システムプロンプト常時ロードから progressive disclosure へ移す。

## 公式情報の調査結果 (2026-06-21)

着手前に、リポジトリ同梱の公式 REST API ドキュメント (`.claude/skills/KintoneRESTAPISkill/docs/`)、
#24 管理系ツール 18 本の実装、kintone 公式ヘルプ (jp.kintone.help) を調査した。判明:

### A. 既に十分カバーされている (= スキルで重複させない)
これらは公式 REST ドキュメントに明記があり、**かつ既に 18 ツールの description と
`APP_DESIGNER_DOMAIN_PROMPT` に大半が埋め込み済み**:

- フィールド種別ごとの JSON 形状 (options の index は文字列、lookup / reference-table / subtable 形状)
- フォーム操作 (add/update/delete fields、get/update layout) と「追加とレイアウト配置は別操作」
- ビュー・プロセス管理・ACL の**全置換セマンティクス** (get→merge→put)
- preview → deploy → get-deploy-status、revision 楽観ロック
- 予約フィールドコード (ステータス/作業者/カテゴリー/レコード番号/作成者/作成日時/更新者/更新日時)
- filterCond 演算子のフィールド型別ルール (選択系・ユーザー系は `in`/`not in` のみ 等)
- CALC の `format` enum (NUMBER / NUMBER_DIGIT / DATETIME / DATE / TIME / HOUR_MINUTE / DAY_HOUR_MINUTE)
  ※ add-form-fields.md に記載あり

### B. 公式 REST ドキュメントに記載が無いギャップ (= スキルの核心)
今日の CONVERT! はここ。**計算フィールドの「式」領域**は REST API ではなく kintone ヘルプ
(自動計算) が一次情報で、しかも各所に散在しており組み立て直しが必要:

- 計算式で使える関数は小さく有限 (公式: [演算子と関数の一覧](https://jp.kintone.help/k/ja/user/app_settings/form/autocalc/autocalc_format.html)):
  - 数値を返す: `SUM` / `ROUND` / `ROUNDUP` / `ROUNDDOWN` / `YEN`
  - 真偽を返す: `IF` / `AND` / `OR` / `NOT` / `CONTAINS`
  - 文字列を返す: `DATE_FORMAT`、結合演算子 `&`
- `DATE_FORMAT` は**文字列**を返す。format を使わず日付を式に入れると **UNIX 時間 (秒・数値)** として
  扱われる (公式: [使用例](https://jp.kintone.help/k/ja/user/app_settings/form/autocalc/example_operators.html))。
  日付・時刻は内部 **Etc/GMT 固定** (公式: [タイムゾーン](https://jp.kintone.help/k/ja/trouble_shooting/calculation/date_format_timezone.html))
- 「**関数の戻り型 (文字列/数値) × CALC 表示形式 × 失敗モード (CONVERT!)**」を 1 つの判断ルールに
  組み立てた資料は公式にも存在しない (CONVERT! の語自体が体系的に説明されていない) ⇒ ここがスキルの付加価値

## スコープ

上記を踏まえ、スキルは「**ツール description の焼き直しではなく、横断・手続き・ギャップを埋める**」ものに絞る。

### 対象 (この skill が扱う)

1. **計算フィールド完全リファレンス (核心・最重要)** — B のギャップを 1 章に組み立てる:
   - 関数インベントリ (上記 11 関数 + `&`) と各々の**戻り型 (文字列/数値)**
   - 判断ルール: 「式が文字列を返す→数値系 format に出せず CONVERT!」「式が数値を返す→NUMBER/DATE 等で出せる」
   - 日付の典型レシピ: 「N 日後 = `date + days*24*60*60` を **format=DATE** で表示 (DATE_FORMAT 不要)」、
     「文字列で日付を出すなら DATE_FORMAT + TZ、ただし CALC では文字列表示できないので別用途」
   - Etc/GMT 固定・タイムゾーンずれの回避、CONVERT! / #DIV/0! の意味と直し方
2. **アプリ構築の手続き知識 (横断レシピ)** — 個々のツール description には収まらない流れ:
   - create-app → add-form-fields → update-form-layout → update-views → process → acl → deploy の標準順序
   - 全置換ツールの get→merge→put 規律、deploy 後の get-deploy-status 待機ループ、revert での破棄
   - 既存アプリ改変時の「現状 get → 差分のみ反映」徹底
3. **設計時の落とし穴の早見 (A の要点を参照集約)** — 予約コード・options 形状・filterCond 型別演算子は
   ツール description にもあるが、設計時に一望できるよう**簡潔な早見表**として再掲 (詳細はツール側に委譲)

### 非対象 (別 skill / 重複回避)
- 実行時の **JavaScript カスタマイズ** → 既存 `kintone-customize-js`
- **プラグイン開発** → 既存 `kintone-plugin-development`
- 各ツールの呼び出し方そのもの (引数仕様) → 各ツールの description が一次情報。スキルは重複させない

## ユーザーストーリー

> **As a** アプリデザイナー (app-designer エージェント / それを使う業務ユーザー)
> **I want to** kintone のアプリ構造設計の定石・落とし穴を必要時に参照しながらツールを実行
> **So that** CONVERT! のような型・表示形式の取り違えで試行錯誤せず、一発で正しいアプリを構築できる

## 受け入れ条件

1. `packages/plugin/src/skills/kintone-app-design/SKILL.md` を新設 (YAML frontmatter `name` / `description`、
   Anthropic Skills API 制約を満たす: name は lowercase+数字+ハイフン/最大64、description 1-1024、予約語不可)
2. build (`scripts/build.mjs`) が当 SKILL.md を `src/generated/skills-bundle.ts` に焼き込む
3. app-designer の `customSkillFilter` が当スキルのみ `true` を返す (現状 `() => false` を変更)
4. Custom Agent のスキルピッカーで当スキルを選択できる
5. `APP_DESIGNER_DOMAIN_PROMPT` を薄くし、詳細は当スキル参照へ誘導 (常時トークン削減)。最重要の数行
   (予約コード・全置換・preview→deploy 等の即死要因) のみコアに残す
6. skill 内容に**計算フィールド章**を含み、CONVERT! の原因と「DATE_FORMAT を使わず数値計算+format=DATE」
   を具体例つきで明記
7. skillsVersion / promptVersion を bump し、既存 app-designer に再 attach される
8. テスト更新: `builtInAgents.test` の app-designer `customSkillFilter` / skills 期待値、必要なら
   skills-bundle 関連テスト
9. `pnpm -r test` / typecheck / lint green

## 制約

- **Anthropic Skills API 仕様**: name 規約、description 1-1024 文字、bundle 合計 < 30MB
- **同期は admin 手動**: ConfigScreen「Skills 同期」を押して初めて workspace に upload される (自動ではない)。
  リリースノート/README にその運用手順を明記
- **現状の SKILL.md は 1 ファイル構成**: 既存 2 skill に倣い `<name>/SKILL.md` 単一ファイルで始める
  (将来 references/ 分割は別途)

## 未決事項 (design.md で確定)

- `APP_DESIGNER_DOMAIN_PROMPT` を「どこまで」薄くするか。調査で分かったとおり現プロンプトの大半 (予約コード /
  options / 全置換 / preview-deploy / filterCond) は**ツール description と重複**しているので、コアには
  「役割・進め方・安全則」と「スキルを参照せよ」の誘導だけ残し、知識本体はスキルへ移す線引きを確定する
- 計算フィールド章で CONVERT! 以外のエラー (#DIV/0! 等) や全関数の例までどこまで載せるか
- 早見表 (落とし穴) をスキルに持つか、プロンプトのコアに残すか (重複管理の最小化)
- skill 本文を 1 ファイル (SKILL.md) に収めるか、計算式リファレンスを references/ に分割するか
  (現状 2 skill は 1 ファイル構成。bundle サイズと progressive disclosure のバランス)
