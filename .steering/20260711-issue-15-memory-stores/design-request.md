# Claude Design 依頼ブリーフ — メモリ閲覧/編集 UI（#15 Step 2 / Settings 統合）

Cowork Agent for kintone の **設定画面（SettingsView）** に、**ユーザーが自分の「メモリ（会話をまたいで蓄積される記憶）」をブラウズ・編集できるセクション** を設計依頼する。成果物は既存ハンドオフ（`docs/design-handoff/task-mechanism/`, `docs/design-handoff/mcp-registration/` 等）と同じ流儀の **hifi 仕様 + 参照 TSX + prototype** を `docs/design-handoff/memory-settings/` として作ること。

このブリーフは「何を設計してほしいか」の input。**既存の SettingsView / SettingsNav / ArtifactPane の意匠・パターンを最大限流用**してほしい（新規発明は最小に）。

---

## 0. 大前提（プロダクトモデル）

**メモリ = Anthropic Managed Agents の Memory Store**。エージェントがセッションを跨いでユーザーの好み・業務文脈を覚えておくための、テキストファイル群。

- ユーザーには **2 つの store** がある（本 UI はこの 2 つだけを扱う）:
  1. **個人設定（preferences）** … 全エージェント共通。口調・日付表記・業務用語エイリアスなど。
  2. **このエージェント（agent-context）** … 現在選択中のエージェント固有の学習・修正記録。
- 各 store は **複数のファイル（Markdown）** を持つ（例 `general.md` / `field-aliases.md` / `notes.md`）。
- 中身は基本 **エージェントが自律的に読み書き**する。この UI はユーザーが **確認し、必要なら手直し（編集/削除）** するためのもの。
- **設定画面（SettingsView）の「メモリ」セクション**として提供する（後述）。メモリの ON/OFF トグル（Header の別コントロール）とは役割が違う。

**今回のスコープ外**（設計しなくてよい）: versions 履歴 / 復元 / redact（別 Issue #149）、ファイル新規作成（任意）、admin 用共有メモリ（Step 3）。

---

## 1. 既存 SettingsView の構造（流用元）

SettingsView は **左 nav（幅 ~192px）+ 右 detail** の 2 カラム。nav 項目は「エージェント / スキル / 定期実行 / MCP サーバー」等。項目ごとに **admin 限定フラグ**があり、非 admin には「定期実行」など per-user 項目だけが出る。

- **今回**: nav に **per-user の「メモリ」項目**（🧠 系アイコン）を 1 つ追加（＝「定期実行」と同じ非 admin 可）。
- **メモリを選ぶと右 detail にメモリ UI**（§2）が出る。
- 非 admin もこの画面を開ける前提（実装側で入口を用意する）。

## 2. 設計してほしいサーフェス — SettingsView「メモリ」detail

右 detail（幅は他セクション detail と同等）に、**2 store のファイルツリー + 選択ファイルの閲覧/編集**を収める。縦構成の提案（確定は Design に委ねる）:

```
メモリ                                    自分の記憶を確認・編集   ← セクション見出し + サブ
────────────────────────────────────────────────────────────
┌ 個人設定（全エージェント共通）───────────┐
│  general.md            2.1 KB      🗑     │   ← ファイル行（名前 + サイズ/更新 + 削除）
│  field-aliases.md      0.4 KB      🗑     │
├ このエージェント（○○）──────────────────┤   ← store 見出し（現在のエージェント名）
│  notes.md              1.2 KB      🗑     │
│  past-corrections.md   空                 │
└──────────────────────────────────────────┘
▼ 選択ファイル: general.md                 [編集]
──────────────────────────────────────────────
# 口調
ですます調。日付は YYYY/MM/DD。                ← Markdown レンダ（閲覧）/ textarea（編集）
                                    [保存] [取消]  ← 編集時のみ
```

配置は「上：2 store のツリー / 下：選択ファイル詳細」の縦割りでも、「左：ツリー / 右：詳細」の入れ子 2 カラムでも良い（detail 幅と相談して Design が決める）。

#### ツリー / リスト部
- **2 store をセクション見出し**で分ける（「個人設定（全エージェント共通）」「このエージェント（<エージェント名>）」）。
- 各ファイル行: **ファイル名 + サイズ（or 更新日）+ 削除**。選択中はハイライト。
- 空 store / 空ファイルの**プレースホルダ**（「まだ記憶がありません」）。

#### ビュー / エディタ部
- 選択ファイルの内容を **Markdown レンダで表示**（既存 artifact の markdown 描画トーンに合わせる）。
- **[編集]** → textarea 化。**[保存] / [取消]**。
- 保存時に **競合（他で更新済み）** が起きうる → 「他で更新されました。再読込します」の**軽いバナー**（既存 Banner 流儀）。
- 保存中 / 読込中の**ローディング**（既存 detail のスケルトン/スピナー流儀）。

#### 削除
- ファイル行の削除 → 既存 `ConfirmDialog` 相当の確認 → 消える。

### 状態バリエーション（各モックが欲しい）
1. **初期 / ファイル未選択**（ツリーだけ、詳細は空プレースホルダ）。
2. **ファイル選択・閲覧**（Markdown レンダ）← 主状態。
3. **編集中**（textarea + 保存/取消）。
4. **空メモリ**（両 store とも seed 直後で中身薄い）。
5. **競合エラー**（保存時 409 の再読込バナー）。
6. **ローディング**（store 解決 + 一覧取得中）。

---

## 3. 流用してほしい既存パターン / 意匠

- **SettingsView / SettingsNav** = 骨格の第一参照（左 nav 項目の追加 + 右 detail の作り）。他セクション（定期実行 / MCP）の detail レイアウト・見出し・余白に合わせる。
- **ArtifactPane** = Markdown レンダ・スケルトン・空状態のトーン参照。
- **CA ブランド**: teal アクセント（`--cw-accent`）+ 既存 `--cw-*` トークン。
- **ConfirmDialog**（削除確認）/ **Banner**（競合・エラー）= 既存を再利用。
- ファイルツリー/リストは既存にドンピシャは無いので、SettingsNav の項目意匠 or ArtifactPane のリストを流用。

## 4. 制約 / 注意

- デスクトップ幅のみ（モバイルはスコープ外）。ダーク/ライトは既存準拠（現状ライト主体）。
- アイコンは既存の inline SVG 流儀（外部アイコンフォント不可）。
- 文言は日本語。ファイルは Markdown。
- **補助 UI**。過剰にリッチにしない（「開いて確認・微修正して閉じる」）。
- versions 履歴タブは**置かない**（#149。将来ここに「履歴」導線が増える余地だけ意識してくれると良い）。

## 5. 成果物

`docs/design-handoff/memory-settings/` に、既存ハンドオフと同じ構成で:
- **hifi 仕様**（レイアウト・状態・トークン・余白の採寸）
- **参照 TSX**（`MemorySection.tsx` 等。SettingsView の 1 セクションとして差し込める形。props 例は下記データ形状）
- **prototype**（状態バリエーションを切り替えられる素の jsx/html）

採寸の最終確定は Claude Design に委ねるが、**既存 SettingsView の 1 セクションとして自然に馴染ませる**ことを最優先にしてほしい。

---

## 参考: データ形状（実装側の確定仕様）

```ts
type MemoryStoreView = {
  kind: 'preferences' | 'agent-context';
  label: string;              // 「個人設定（全エージェント共通）」/「このエージェント（○○）」
  storeId: string;            // memstore_...
  files: MemoryFile[];
};

type MemoryFile = {
  id: string;                 // mem_...
  path: string;               // '/preferences/general.md'（表示は basename 'general.md'）
  sizeBytes: number;
  updatedAt: string;
  // content は選択時に別途 retrieve（view=full）で取得。編集保存は content_sha256 楽観ロック。
};
```

- セクションは表示・編集専用。読み書きは Anthropic Memory API（host 側 REST）経由で実装側が担う。
- 非 admin が設定画面を開ける入口、および nav への「メモリ」項目追加は実装側で配線する。
