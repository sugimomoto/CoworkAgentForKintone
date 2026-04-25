// Shared scenario data for US-01 (自然言語でのレコード検索・集計)
// All three variants play out this same story with different UI treatments.

const SCENARIO = {
  // Initial greeting (variant-agnostic text; components can restyle)
  greeting: {
    agent: 'Aoi',
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

window.SCENARIO = SCENARIO;
