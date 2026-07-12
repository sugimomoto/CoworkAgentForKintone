// リリースノート（更新情報）のデータ。/releases/ ページが描画する。
//
// 運用: 新しいリリースのたびに、先頭に 1 エントリ追加する（version / date / highlights）。
// GitHub の自動生成ノート（PR 列挙）ではなく、ユーザー向けに要点をキュレーションする。
// release-kit（packages/landing/release-kit/）の統合スペックから notes.mjs で生成できる。
// OGP カードと同じ「目玉 2〜3 個」を highlights に揃えると一貫する。

export type ReleaseIcon = 'bell' | 'clock' | 'grid' | 'shield' | 'wrench' | 'doc';

export interface ReleaseHighlight {
  icon: ReleaseIcon;
  title: string;
  desc: string;
  /** その回の新機能なら true（NEW バッジ） */
  isNew?: boolean;
}

export interface Release {
  /** 表示用バージョン（例 'v0.2.0' / 'v0.1.0 – v0.1.2'） */
  version: string;
  /** ISO 日付（YYYY-MM-DD） */
  date: string;
  /** GitHub のタグ（Releases へのリンク用。範囲表記なら代表タグ） */
  tag: string;
  /** その回のテーマ（1 行） */
  title: string;
  /** 概要（1 段落） */
  summary: string;
  highlights: ReleaseHighlight[];
}

export const releases: Release[] = [
  {
    version: 'v0.5.0',
    date: '2026-07-12',
    tag: 'plugin-v0.5.0',
    title: 'エージェントが計画を立て、会話を覚える。',
    summary:
      '多段の作業を計画→進捗→完了で見える化する「タスク機構」、会話をまたいでユーザーの好み・業務用語を引き継ぐ「メモリ」、全エージェント共通の作法を設定画面から編集できる「システムプロンプトのカスタマイズ」を追加しました。あわせて Mermaid 図の拡大縮小/パン・CJK 対応、チャットの最新追従など、表示まわりも改善しています。',
    highlights: [
      {
        icon: 'doc',
        title: 'タスク機構（作業の計画と進捗の見える化）',
        isNew: true,
        desc: '多段の作業をエージェントが計画→進捗→完了で宣言し、会話の下部にピン留めされた進捗チェックリスト（PlanPanel）で可視化します。今どこまで進んでいるか、何が残っているかが一目で分かります。',
      },
      {
        icon: 'grid',
        title: '会話をまたぐ記憶（Memory Stores）',
        isNew: true,
        desc: '口調・業務用語・過去の修正をエージェントが記憶し、次の新しい会話に引き継ぎます。「いつもの言い回し」「お客様アプリは ID 5」を毎回説明する必要がありません。設定画面から記憶を確認・編集でき、トグルで ON/OFF を切り替えられます。',
      },
      {
        icon: 'wrench',
        title: 'システムプロンプトのカスタマイズ',
        isNew: true,
        desc: '全エージェントに共通で効く「基本の作法（トーン・誠実さ・ツールの使い方など）」を、プラグイン設定画面から編集できるようになりました。各エージェント固有の指示（persona）とは分離され、変更は次の会話からすぐ反映されます（デフォルトに戻すのも 1 クリック）。',
      },
    ],
  },
  {
    version: 'v0.4.0',
    date: '2026-07-06',
    tag: 'plugin-v0.4.0',
    title: 'kintone の外部サービスも、エージェントの道具にする。',
    summary:
      'kintone 以外のリモート MCP サーバー（Notion・GitHub など）を登録して、エージェントの道具として使えるようになりました。管理者がテナントに登録し、各ユーザーは自分のアカウントで接続（認証なし / API キー / OAuth）。エージェントごとに使えるツールを選べます。あわせて操作性の改善・修正も入っています。',
    highlights: [
      {
        icon: 'grid',
        title: '追加 MCP サーバー登録（外部サービス連携）',
        isNew: true,
        desc: 'kintone 以外のリモート MCP サーバー（Notion・GitHub など）を登録し、エージェントの道具として使えます。管理者がテナントに登録、各ユーザーは自分のアカウントで接続し、エージェントごとに使えるツールを選択できます。',
      },
      {
        icon: 'shield',
        title: '認証なし / API キー / OAuth に対応',
        isNew: true,
        desc: 'サーバーに合わせて、認証なし・API キー・OAuth（PKCE、client_secret 方式の両対応）で接続できます。認証情報は各ユーザーごとに安全に保管し、ブラウザ側の JavaScript には露出しません。',
      },
      {
        icon: 'wrench',
        title: '操作性の改善・修正',
        desc: 'クイックアクションでの添付ファイル送信、会話履歴ビューの戻るボタン、チャット起動アイコン（FAB）の視認性改善など、細かな使い勝手を整えました。',
      },
    ],
  },
  {
    version: 'v0.3.0',
    date: '2026-06-21',
    tag: 'plugin-v0.3.0',
    title: '資料から、kintone アプリを設計・構築する。',
    summary:
      '業務内容や PDF・Excel を読み解いて kintone アプリを設計・構築する「アプリデザイナー」を追加しました。あわせて、フィールドからデプロイまで扱えるアプリ管理系ツールと、レコードのステータス・作業者を動かすプロセス管理操作に対応しています。',
    highlights: [
      {
        icon: 'doc',
        title: 'アプリデザイナー（資料からアプリ設計・構築）',
        isNew: true,
        desc: '業務内容や PDF・Excel・Word を読み解き、フィールド・フォーム・一覧・プロセス管理まで設計して、会話しながら実際に kintone アプリを構築します。計算フィールドなどの落とし穴を押さえた設計ナレッジ（スキル）付き。',
      },
      {
        icon: 'wrench',
        title: 'アプリ管理系ツール（18種）',
        isNew: true,
        desc: 'フィールドの追加・変更、フォームレイアウト、一覧ビュー、プロセス管理設定、権限（ACL）、カスタマイズ、デプロイまで——アプリ設定をエージェントから直接操作できます。変更は preview に積み、承認のうえ本番へ反映します。',
      },
      {
        icon: 'grid',
        title: 'プロセス管理の操作（ステータス・作業者）',
        isNew: true,
        desc: '「このレコードを完了に」「未対応を全部○○さんへ」のように、レコードのステータス変更（一括可）と作業者変更を自然言語で実行できます。',
      },
    ],
  },
  {
    version: 'v0.2.0',
    date: '2026-06-20',
    tag: 'plugin-v0.2.0',
    title: '通知と定期実行で、"待たない"運用へ。',
    summary:
      'Slack / Microsoft Teams / Discord への通知と、cron スケジュールによる定期実行に対応しました。あわせて内部の大規模リファクタと複数の不具合修正で土台を強化しています。',
    highlights: [
      {
        icon: 'bell',
        title: '通知（Slack / Teams / Discord）',
        isNew: true,
        desc: 'エージェントごとに Incoming Webhook を 1 つ登録すると、集計結果やタスク完了をチャンネルへ自動送信。Webhook URL は Vault に秘匿保存されます。',
      },
      {
        icon: 'clock',
        title: '定期実行（スケジュール）',
        isNew: true,
        desc: '対象エージェント・依頼内容・スケジュール（毎日／毎週／毎月）を登録すると、指定時刻に自動起動。実行結果は履歴から会話単位で確認できます。',
      },
      {
        icon: 'shield',
        title: '安定性・品質の向上',
        desc: '大規模リファクタに加え、ビルトインのクイックアクション／公開先の反映や、エージェント編集保存などの不具合を修正しました。',
      },
    ],
  },
  {
    version: 'v0.1.0 – v0.1.2',
    date: '2026-06-08',
    tag: 'plugin-v0.1.2',
    title: '初の公開リリース。',
    summary:
      'kintone のレコード一覧に常駐する AI コワーカーの基盤を公開。自然言語での検索・集計・更新から、カスタマイズ JS 生成、エージェント／スキル管理までを提供します。',
    highlights: [
      {
        icon: 'grid',
        title: 'AI コワーカー基盤',
        desc: 'レコードの検索・集計・更新・転記・レポート作成を、ふだんの言葉で依頼。破壊的操作は承認カードで安全に。',
      },
      {
        icon: 'wrench',
        title: 'カスタマイズ JS 生成（Customizer）',
        desc: 'プレビュー → 適用 → ロールバックの安全な流れで、kintone のカスタマイズ JS を生成・反映。',
      },
      {
        icon: 'doc',
        title: 'エージェント／スキル管理・公開先 ACL',
        desc: '業務別エージェントの編集・追加、Custom Skill の同期、エージェントの公開先（ユーザー／グループ／組織）の絞り込み。',
      },
    ],
  },
];
