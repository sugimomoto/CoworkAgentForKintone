// Cowork Agent for kintone — 初回チャット画面の案内メッセージ
//
// messages が空 / sessionId が未確立のときに表示する静的ガイダンス。
// API 呼び出しは行わず、純粋に UI 上の見え方の問題を解決する。
// Phase 1b 以降で内容を agent からの動的応答に差し替える可能性あり。

export function WelcomeMessage(): JSX.Element {
  return (
    <div
      data-testid="welcome-message"
      className="flex-1 overflow-y-auto px-[16px] py-[20px] text-[13px] leading-[1.7] text-text"
    >
      <h3 className="text-[15px] font-semibold text-text">Cowork Agent へようこそ！</h3>
      <p className="mt-[10px]">
        私は <strong>kintone の業務支援エージェント「Cowork Agent」</strong> です。
        <br />
        現在、kintone への接続機能は <strong>セットアップ中</strong>{' '}
        のため、まだ直接のデータ操作はできませんが、以下のようなご支援が可能です。
      </p>

      <hr className="my-[16px] border-border" />

      <h4 className="mt-[12px] text-[13px] font-semibold text-text">📌 現在できること</h4>
      <ul className="mt-[6px] list-disc pl-[20px]">
        <li>
          <strong>kintone の基本的な使い方</strong>のご案内
        </li>
        <li>
          <strong>アプリ設計・フィールド構成</strong>のアドバイス
        </li>
        <li>
          <strong>自動化・プロセス管理</strong>の活用方法のご提案
        </li>
        <li>
          <strong>API・連携機能</strong>に関する情報提供
        </li>
      </ul>

      <h4 className="mt-[14px] text-[13px] font-semibold text-text">
        🔜 今後できるようになること(接続後)
      </h4>
      <ul className="mt-[6px] list-disc pl-[20px]">
        <li>kintone アプリへのレコード登録・検索・更新</li>
        <li>業務データの集計・レポート作成</li>
        <li>ワークフローの自動化サポート</li>
        <li>複数アプリをまたいだデータ連携</li>
      </ul>

      <p className="mt-[16px] text-[12px] text-muted">
        メッセージを送信すると新しい会話を開始します。
      </p>
    </div>
  );
}
