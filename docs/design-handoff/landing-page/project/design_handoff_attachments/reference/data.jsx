// Shared scenario data for US-01 (自然言語でのレコード検索・集計)
// All three variants play out this same story with different UI treatments.

const SCENARIO = {
  // Initial greeting (variant-agnostic text; components can restyle)
  greeting: {
    agent: 'Cowork Agent for kintone',
    role: 'コワーカーエージェント',
    status: 'active', // active | working | waiting
    hello: 'こんにちは。今日はどんな作業をお手伝いしましょうか？',
    suggestions: [
      '今月の受注状況を教えて',
      '未対応の問い合わせを集計',
      'カテゴリ未設定のレコードを整理',
    ],
  },

  // The interaction script — each step is a turn in the conversation.
  // kind:
  //   user      — user message
  //   thinking  — agent "thinking" placeholder
  //   agent     — agent message (text)
  //   tool      — tool call card (get_apps, get_records, etc.)
  //   plan      — HITL plan card (requires approval)
  //   progress  — async job progress card
  //   result    — final result card (table / summary)
  script: [
    {
      kind: 'user',
      text: '今月の受注金額が500万円以上の案件を担当者ごとに集計して',
    },
    {
      kind: 'thinking',
      text: '関連アプリを確認しています',
    },
    {
      kind: 'tool',
      name: 'get_apps',
      label: 'アプリ一覧を取得',
      detail: '3件のアプリが見つかりました',
      items: ['案件管理', '顧客マスタ', '活動履歴'],
    },
    {
      kind: 'tool',
      name: 'get_app_schema',
      label: '案件管理のスキーマを取得',
      detail: '24フィールド（受注金額、担当者、受注日ほか）',
    },
    {
      kind: 'agent',
      text: '「案件管理」アプリを使って集計します。対象範囲を確認させてください。',
    },
    {
      // Read-only plan — executes without explicit approval but still surfaced
      kind: 'plan',
      title: '集計プラン',
      destructive: false,
      steps: [
        { op: 'query', text: '案件管理 から 受注日 ∈ 2026年4月 かつ 受注金額 ≥ 5,000,000 を抽出' },
        { op: 'agg', text: '担当者フィールドでグループ化し、受注金額を合計' },
        { op: 'sort', text: '合計金額の降順で表示' },
      ],
      estimate: '読み取りのみ · 約2秒',
    },
    {
      kind: 'progress',
      title: 'レコード取得中',
      total: 342,
      done: 342,
      substeps: [
        { label: 'クエリ実行', done: true },
        { label: 'カーソル取得 (342件)', done: true },
        { label: '集計処理', done: true },
      ],
    },
    {
      kind: 'result',
      title: '2026年4月・受注500万円以上の案件',
      subtitle: '18件 · 合計 ¥ 187,400,000',
      rows: [
        { name: '田中 美咲', count: 5, total: 62300000 },
        { name: '佐藤 健一', count: 4, total: 48100000 },
        { name: '鈴木 葵',   count: 3, total: 31800000 },
        { name: '山田 拓也', count: 3, total: 27400000 },
        { name: '中村 玲奈', count: 2, total: 12300000 },
        { name: '小林 大輔', count: 1, total: 5500000 },
      ],
      followups: [
        'CSVでダウンロード',
        '先月と比較',
        'Slackに共有',
      ],
    },
  ],

  // A second "destructive" scenario fragment, shown separately (one artboard
  // per variant previews the HITL approval moment).
  hitl: {
    userQuery: 'カテゴリが空のレコードに「未分類」を設定して',
    plan: {
      title: '一括更新プラン',
      destructive: true,
      steps: [
        { op: 'query',  text: '案件管理 から カテゴリ IS EMPTY を抽出' },
        { op: 'count',  text: '対象レコード数: 47件' },
        { op: 'update', text: 'カテゴリ フィールドを「未分類」に更新' },
      ],
      impact: {
        app: '案件管理',
        field: 'カテゴリ',
        records: 47,
        reversible: true,
      },
      estimate: '書き込み · 約8秒 · バックグラウンド実行',
    },
  },
};

// ────────────────────────────────────────────────────────
// Artifact samples — 再利用可能な成果物のショーケース
// ────────────────────────────────────────────────────────
const ARTIFACTS = {
  // 1) Markdown レポート
  monthlyReport: {
    id: 'monthly-report-2026-04',
    kind: 'markdown',
    title: '2026年4月 受注レポート',
    summary: '受注総額・担当者別ランキング・前月比をまとめました',
    updatedAt: '14:32',
    content: `# 2026年4月 受注レポート

## サマリー

- **受注総額**: ¥187,400,000（前月比 **+18.2%**）
- **受注件数**: 18件
- **平均単価**: ¥10,411,000
- **トップ担当**: 田中 美咲（5件 / ¥62,300,000）

## 担当者別ランキング

| 順位 | 担当者 | 件数 | 受注金額 |
|---|---|---|---|
| 1 | 田中 美咲 | 5 | ¥62,300,000 |
| 2 | 佐藤 健一 | 4 | ¥48,100,000 |
| 3 | 鈴木 葵 | 3 | ¥31,800,000 |
| 4 | 山田 拓也 | 3 | ¥27,400,000 |
| 5 | 中村 玲奈 | 2 | ¥12,300,000 |

## ハイライト

> 日立コンサル契約 (¥22,400,000) が単月最大案件。継続契約の延長交渉が奏功。

## 来月の見込み

- パイプライン: ¥240,000,000（提案中フェーズ）
- 確度Aの案件: 6件 / ¥98,000,000
- 要フォロー: 楽天追加開発、キヤノンシステム更改

---

*このレポートは自動生成されました。kintone「案件管理」アプリの 2026-04-01 〜 2026-04-30 のレコードを集計しています。*`,
  },

  // 2) HTML ワイヤフレーム (sandbox preview)
  wireframe: {
    id: 'settings-wireframe-v1',
    kind: 'html',
    title: '設定画面ワイヤフレーム',
    summary: 'プラグイン設定UIの初稿',
    updatedAt: '14:18',
    content: `<!doctype html>
<html><head><style>
body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #333; }
.card { background: #fff; border-radius: 8px; padding: 20px; max-width: 480px; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
h1 { font-size: 18px; margin: 0 0 4px; }
.sub { color: #888; font-size: 12px; margin-bottom: 20px; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee; }
.row:last-child { border: none; }
.label { font-size: 13px; }
.hint { font-size: 11px; color: #888; }
.toggle { width: 36px; height: 20px; background: #4f46e5; border-radius: 10px; position: relative; }
.toggle::after { content: ''; position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; }
.toggle.off { background: #ccc; }
.toggle.off::after { right: auto; left: 2px; }
select { padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; }
.btn { background: #4f46e5; color: #fff; border: none; padding: 9px 18px; border-radius: 4px; font-size: 13px; cursor: pointer; margin-top: 16px; }
</style></head>
<body>
  <div class="card">
    <h1>カスタマイズ設定</h1>
    <div class="sub">アプリ「案件管理」のカスタマイズオプション</div>
    <div class="row">
      <div><div class="label">ステータス自動色付け</div><div class="hint">完了行を緑、要対応行を赤で表示</div></div>
      <div class="toggle"></div>
    </div>
    <div class="row">
      <div><div class="label">通知</div><div class="hint">レコード追加時に Slack へ通知</div></div>
      <div class="toggle off"></div>
    </div>
    <div class="row">
      <div><div class="label">表示密度</div></div>
      <select><option>標準</option><option>コンパクト</option></select>
    </div>
    <button class="btn">変更を保存</button>
  </div>
</body></html>`,
  },

  // 3) Mermaid 図
  diagram: {
    id: 'app-relations-er',
    kind: 'mermaid',
    title: 'アプリ間参照関係',
    summary: '案件管理 ↔ 顧客マスタ ↔ 活動履歴 のER図',
    updatedAt: '14:08',
    content: `erDiagram
    顧客マスタ ||--o{ 案件管理 : "顧客ID"
    案件管理 ||--o{ 活動履歴 : "案件ID"
    顧客マスタ ||--o{ 活動履歴 : "顧客ID"
    顧客マスタ {
        string 顧客ID PK
        string 会社名
        string 業種
        string 担当者
    }
    案件管理 {
        string 案件ID PK
        string 顧客ID FK
        string 案件名
        number 受注金額
        string ステータス
        date 受注日
    }
    活動履歴 {
        string 活動ID PK
        string 案件ID FK
        string 顧客ID FK
        date 日時
        string 種別
        text 内容
    }`,
  },
};

// ────────────────────────────────────────────────────────
// Attachment showcase data — Step 1 (Foundation) のチャット側 UI 確認用
// ────────────────────────────────────────────────────────
const ATTACHMENT_SAMPLES = {
  // 入力中: 複数の状態が混在 (ready × 2, reading × 1)
  composing: [
    { localId: 'a1', filename: '顧客リスト.csv',          size: 12 * 1024,             mimeType: 'text/csv',         kind: 'text',     status: 'ready' },
    { localId: 'a2', filename: '提案書_v3.pdf',           size: 2.4 * 1024 * 1024,     mimeType: 'application/pdf',  kind: 'document', status: 'ready' },
    { localId: 'a3', filename: 'ホワイトボード.png',      size: 1.1 * 1024 * 1024,     mimeType: 'image/png',        kind: 'image',    status: 'reading' },
  ],
  // ready 1件のみ
  single: [
    { localId: 'b1', filename: '4月_受注一覧.csv',         size: 38 * 1024,             mimeType: 'text/csv',         kind: 'text',     status: 'ready' },
  ],
  // error を含む
  withError: [
    { localId: 'c1', filename: '営業資料.pdf',             size: 1.8 * 1024 * 1024,     mimeType: 'application/pdf',  kind: 'document', status: 'ready' },
    { localId: 'c2', filename: '動画素材.mp4',             size: 18 * 1024 * 1024,      mimeType: 'video/mp4',        kind: 'document', status: 'error', errorText: '未対応の拡張子' },
    { localId: 'c3', filename: 'over.pdf',                size: 12 * 1024 * 1024,      mimeType: 'application/pdf',  kind: 'document', status: 'error', errorText: 'サイズ上限 (10 MB) 超過' },
  ],
  // 大量 + 合計サイズ警告
  bulky: [
    { localId: 'd1', filename: 'screen-01.png', size: 4.2 * 1024 * 1024, mimeType: 'image/png', kind: 'image', status: 'ready' },
    { localId: 'd2', filename: 'screen-02.png', size: 3.9 * 1024 * 1024, mimeType: 'image/png', kind: 'image', status: 'ready' },
    { localId: 'd3', filename: 'screen-03.png', size: 5.1 * 1024 * 1024, mimeType: 'image/png', kind: 'image', status: 'ready' },
    { localId: 'd4', filename: 'requirements.pdf', size: 8.4 * 1024 * 1024, mimeType: 'application/pdf', kind: 'document', status: 'ready' },
    { localId: 'd5', filename: 'data-export.csv', size: 9.8 * 1024 * 1024, mimeType: 'text/csv', kind: 'text', status: 'ready' },
  ],
  empty: [],
};

// ユーザーメッセージに残る送信済み添付サンプル
const SENT_ATTACHMENTS_SAMPLE = [
  { filename: '顧客リスト.csv', kind: 'text' },
  { filename: '提案書_v3.pdf', kind: 'document' },
];

window.SCENARIO = SCENARIO;
window.ARTIFACTS = ARTIFACTS;
window.ATTACHMENT_SAMPLES = ATTACHMENT_SAMPLES;
window.SENT_ATTACHMENTS_SAMPLE = SENT_ATTACHMENTS_SAMPLE;
