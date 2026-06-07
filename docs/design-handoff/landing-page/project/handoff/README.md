# プリセットエージェント一覧（案 A・アコーディオン）— 実装ハンドオフ

チャットパネルの空状態に表示する**プリセットエージェント一覧**の本実装一式です。
「2 クリックで価値が出る」UX — (1) エージェントを選び (2) サンプルプロンプトを押す → 即実行 → 成果物 → そのまま対話継続 — を成立させます。

## ファイル

| ファイル | 役割 |
|---|---|
| `agents.ts` | 型定義 (`PresetAgent` 他) と Phase 1 カタログ、`publicAgents` / `defaultOpenId` ヘルパ |
| `AgentGlyph.tsx` | `iconKind` ごとのラインアイコン（`currentColor` 着色・Tailwind サイズ） |
| `PresetAgentLanding.tsx` | 本体。アコーディオン一覧 + エッジケース分岐 |

## 使い方

`WelcomeMessage` の代わりに、**履歴が空 & セッション未開始**のときだけメインエリアに差し込みます。
Header / ConversationUtilityBar / Composer は既存パネルのものをそのまま使います。

```tsx
import { PresetAgentLanding } from './PresetAgentLanding';
import { PRESET_AGENTS, PresetAgent } from './agents';

function MainArea() {
  const isEmpty = messages.length === 0 && !sessionStarted;

  const handleSelectPrompt = (agent: PresetAgent, prompt: string) => {
    selectAgent(agent.id);                 // 該当エージェントを選択
    if (prompt) sendUserMessage(prompt);   // user message として送信 → ストリーミング開始
    else focusComposer();                  // サンプル 0 個のときは自由入力へ
    // view 遷移は既存の「メッセージがある＝チャット表示」ロジックに委ねる
  };

  if (isEmpty) {
    return (
      <PresetAgentLanding
        agents={PRESET_AGENTS}
        onSelectPrompt={handleSelectPrompt}
      />
    );
  }
  return <MessageList messages={messages} />;
}
```

`onSelectPrompt(agent, prompt)` だけが外部依存です。**チャット遷移と送信は呼び出し側**で行ってください
（`messages` が入れば既存の MessageList 表示に切り替わる前提）。

## 設計の要点

- **空状態では一覧が Agent ピッカーを兼ねる** → Header はブランド表示のみにし、ピッカー UI を二重に出さない。プロンプト押下でエージェントが確定し、以降の切替は Header ピッカーに一本化。履歴が空に戻れば再びこの一覧へ。
- **既定エージェント (`isDefault`) を初期展開** → 初回 1 クリックで実行でき、2 クリック要件をさらに短縮。
- **自由入力の逃げ道は常時確保**：下部 Composer（主導線）＋ UtilityBar の「新しい会話 / 履歴」。プロンプトを書ける層を排除しない。

## マイクロインタラクション（遷移）

要望に合わせ **即切替 + 軽いフェード**（160ms 程度）。押下ボタンは `active:` で accent 塗り＋わずかに沈む（`active:scale-[0.99]`）。
凝ったモーフが必要になった場合は `Preset Agent Panel — Prototype.html` の段階遷移（押下 → user バブルへモーフ → 応答）を参照。

## エッジケース（`PresetAgentLanding` 内で処理済み）

| ケース | 挙動 |
|---|---|
| サンプル 0 個 | 行展開時に「自由入力で話しかける」CTA を表示 |
| エージェント 1 個のみ | リスト chrome を省略し、そのエージェントのプロンプトを直接提示 |
| 10 個以上（#46 後） | 6 個超で検索ボックスを自動表示（`searchable` で強制も可）。行は縦に積むので破綻しない |
| 幅 360px ちょうど | 1 カラム固定・余白 12px で成立（横スクロール/2 段組なし） |

## スタイル前提

- **Tailwind CSS**。アクセントは `teal-600`（落ち着いた業務 SaaS トーン）。`tailwind.config` の `theme.extend.colors.accent` に寄せる場合は `teal-*` を置換してください。
- 角丸 10〜12px / 影は最小限・境界線で領域分け / 本文 12.5px・見出し 15px・細字 10.5px。
- 日本語のみ（i18n なし）。フォントは `Noto Sans JP` 系を想定。

## カタログの差し替え

`PRESET_AGENTS` はサンプル。実運用では admin 設定 API から取得し、同じ `PresetAgent[]` 型に詰めて渡してください。
`visibility === 'public'` のものだけが `publicAgents()` で一覧に出ます。
