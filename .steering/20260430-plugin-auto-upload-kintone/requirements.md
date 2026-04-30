# プラグイン: 添付ファイルを kintone へ自動 upload — 要求

GitHub Issue: #27

## 背景
- Phase B-2 (Issue #23) で MCP 側に `kintone-upload-file` を実装したが、Agent (LLM) が
  チャットに添付された PDF / 画像のバイナリに**直接アクセスできない**仕様上の制約に
  ぶつかった。
- 現状の content block (text / document / image) は LLM 入力としては読めるが、
  base64 を tool 引数として再出力するのは LLM にとって不自然 (10MB の base64 を
  正確に書き出すのは事実上不可能)。

## 提案
- ユーザーが添付ファイルを Composer に追加した時点で、プラグインが**並行して**
  kintone `/k/v1/file.json` に直接 upload して fileKey を取得する。
- 取得した fileKey はチャット送信時に**メタ情報として content block に差し込む**ことで
  Agent から見えるようにする。Agent は fileKey をそのまま `kintone-update-record` の
  FILE フィールド値として使える。

## スコープ
- 既存の content block (PDF/画像/text) 経路は維持する。Agent はファイル内容を読む
  目的では従来通り使える。
- kintone upload は best-effort: 失敗しても content block はそのまま送る。Agent には
  upload 失敗を伝えない (Agent の混乱を防ぐ)。
- UI で「kintone に保存済」を示す小さい indicator を AttachmentChip に追加。

## 非スコープ
- 1 ファイル 10 MB 上限 (既存制限) は変更しない (kintone はもっと大きいファイルも
  許可するが、Anthropic への base64 inline 上限と整合させる)。
- ドラッグ&ドロップ / 右ペイン Files タブ等の Issue #16 オリジナル案の他要素は対象外。

## 受入条件
- [ ] PDF / 画像を Composer に添付すると、プラグインが kintone へ POST `/k/v1/file.json`
  を実行
- [ ] 成功で `AttachedFile.kintoneFileKey` に保存
- [ ] チャット送信時、メッセージの末尾に「kintone に保存したファイル」セクションを
  text block で差し込み、Agent が fileKey を参照可能
- [ ] Agent が fileKey をそのまま `kintone-update-record` の FILE フィールド値に渡せる
- [ ] kintone upload 失敗時は content block だけ送る (UI チップは indicator 無し)
- [ ] 既存 522 tests + 新規ケースで全 green
