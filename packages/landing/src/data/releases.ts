// リリースノート（更新情報）のデータ。/releases/ ページが描画する。
//
// 運用: 新しいリリースのたびに、先頭に 1 エントリ追加する（version / date / highlights）。
// GitHub の自動生成ノート（PR 列挙）ではなく、ユーザー向けに要点をキュレーションする。
// OGP カード（release-ogp スキル）と同じ「目玉 2〜3 個」を highlights に揃えると一貫する。

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
