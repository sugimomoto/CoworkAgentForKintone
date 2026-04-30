# 再認可 UI — 設計

## 配置
- Header の icon button 列に「kintone を再連携」ボタンを追加。
- アイコンはリンク鎖 (LinkIcon) で「接続」を示唆。
- 位置: 履歴 / 新規会話 / **再連携 (新規)** / 設定 / 閉じる の順 (既存 button の右側)。

## 表示条件
- `onReconnectKintone` prop 有り、かつ `bindingStatus === 'bound' | 'binding' | 'error'` のとき表示。
- `unbound` のときは表示しない (ConnectKintoneButton 側で大きく誘導するため重複しない)。
- `binding` 中は `disabled` にしてアイコンを薄く + spinner overlay。

## Props 拡張

```ts
// Header.tsx
interface HeaderProps {
  // ...existing...
  onReconnectKintone?: () => void;
  reconnectDisabled?: boolean;   // bindingStatus === 'binding' のとき true
  reconnectVisible?: boolean;    // bindingStatus が bound / binding / error のとき true
}
```

`reconnectVisible` をヘッダ側に分離するのは UX 判断 (unbound 時は ConnectKintoneButton と重複)。

## ChatPanel での連結

```tsx
<Header
  // ...
  onReconnectKintone={handleConnect}
  reconnectDisabled={bindingStatus === 'binding'}
  reconnectVisible={
    bindingStatus === 'bound' ||
    bindingStatus === 'binding' ||
    bindingStatus === 'error'
  }
/>
```

`handleConnect` は既存 (`useUserBinding.connect`) を再利用。

## 確認ダイアログ
- 初回実装ではダイアログ無し (クリック → 即 OAuth popup) で十分シンプル。
- 誤クリックリスクは低い (アイコンサイズ 30px + ホバー)。
- 必要なら次イテレーションで追加。

## テスト

### Header.test.tsx (新規ケース)
- `reconnectVisible=true` のとき再連携ボタンが描画される
- `onReconnectKintone` が呼ばれる
- `reconnectDisabled=true` のときクリック無効

### ChatPanel.test.tsx (新規ケース)
- bound 状態で Header の再連携ボタンを押すと `useUserBinding.connect` が呼ばれる (mock)

## 実装上の注意

`useUserBinding.connect()` 内部で `inFlightConnectRef` で多重起動を防いでいるので、ボタン側の disabled とは別に二重防御がある。問題なし。
