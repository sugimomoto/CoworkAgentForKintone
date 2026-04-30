# 再認可 UI — 要求

GitHub Issue: #28

## 背景
- bound 状態でも UI から再認可できないため、OAuth scope を拡張した直後にユーザーは詰む。
- 既存 `useUserBinding.connect()` は existing credentialId の upsert を扱う実装になっているため、再呼出だけで credential 更新が動く。

## 要件
- bound 状態でも常に再連携できる UI 要素を Header に置く。
- 再連携中 (`bindingStatus === 'binding'`) はボタンを disabled にし、視覚的にフィードバック。
- 既存の OAuth 失効バナー (`bindingStatus === 'error' && isMidSession`) と矛盾しない (バナーは error 時のみ、ボタンは常時)。
- Vitest でコンポーネント / 統合レベルのテストを追加。

## 受入条件
- [ ] Header に「kintone を再連携」アクションを置き、bound 状態でもアクセスできる
- [ ] クリックで `useUserBinding.connect()` が起動し、新しい access_token で既存 credential が差し替わる
- [ ] 連携中は disabled 状態
- [ ] エラー時は既存の error 経路に乗る (`bindingStatus === 'error'`)
- [ ] Header.test / ChatPanel.test の更新
