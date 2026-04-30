// Cowork Agent for kintone — ファイル添付機能の型定義
//
// Issue #16 Step 1 (Foundation)。Composer から添付されたファイルは chatStore に保管され、
// 送信時に Anthropic content block (text / document / image) に変換されて user.message に乗る。
//
// 仕様: docs/design_handoff_attachments/README.md (high-fidelity デザインハンドオフ)

/** content block 経路の判別 (拡張子から自動決定) */
export type AttachmentKind = 'text' | 'document' | 'image';

/**
 * 添付ファイルのライフサイクル:
 *   pending  — 追加直後 (validation 通過済、読込開始前)
 *   reading  — FileReader 進行中
 *   ready    — 読込完了、送信可能
 *   error    — バリデーション or 読込失敗
 */
export type AttachedFileStatus = 'pending' | 'reading' | 'ready' | 'error';

/**
 * kintone への parallel upload (Issue #27) の進行状態。
 * - uploading: in-flight
 * - uploaded:  fileKey を取得済 (kintoneFileKey に保存)
 * - failed:    失敗 (best-effort なので UI で警告は出さない)
 */
export type KintoneUploadStatus = 'uploading' | 'uploaded' | 'failed';

export interface AttachedFile {
  /** UI / 削除キー用 (chatStore 内のユニーク ID) */
  localId: string;
  filename: string;
  /** バイト数 (10 MB 上限) */
  size: number;
  mimeType: string;
  kind: AttachmentKind;
  status: AttachedFileStatus;
  /** error 時のメッセージ (チップに表示) */
  errorText?: string;
  /**
   * 読込完了後の content。
   * - kind=text → UTF-8 デコード済の文字列
   * - kind=document/image → base64 文字列 (`data:` prefix 無し)
   */
  content?: string;
  /**
   * kintone /k/v1/file.json に保存できた場合の fileKey (Issue #27)。
   * 値がセットされていれば送信時にメタ block として Agent に渡される。
   */
  kintoneFileKey?: string;
  /** kintone upload の進行状態 (best-effort, UI / debug 用) */
  kintoneUpload?: KintoneUploadStatus;
}

/** 拡張子 → kind / MIME マップ (本フェーズでサポートする 10 種) */
export const EXTENSION_TO_KIND: Record<string, { kind: AttachmentKind; mime: string }> = {
  // text 系 (FileReader.readAsText で UTF-8 デコードして text block に inline)
  txt:  { kind: 'text', mime: 'text/plain' },
  md:   { kind: 'text', mime: 'text/markdown' },
  json: { kind: 'text', mime: 'application/json' },
  csv:  { kind: 'text', mime: 'text/csv' },
  // document (FileReader.readAsDataURL → base64 → document block の source.base64)
  pdf:  { kind: 'document', mime: 'application/pdf' },
  // image (同上で image block の source.base64)
  png:  { kind: 'image', mime: 'image/png' },
  jpg:  { kind: 'image', mime: 'image/jpeg' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  gif:  { kind: 'image', mime: 'image/gif' },
  webp: { kind: 'image', mime: 'image/webp' },
};

/** ホワイトリスト (ファイルピッカーの accept や validation で使う) */
export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_KIND);

/** `<input accept="...">` 用の文字列 (ドット付き、カンマ区切り) */
export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(',');

/** サイズ / 件数の制限 */
export const FILE_LIMITS = {
  /** 1 ファイルの最大バイト数 (10 MB) */
  perFileBytes: 10 * 1024 * 1024,
  /** 1 メッセージあたりの最大ファイル数 */
  maxFilesPerMessage: 10,
  /** 1 メッセージの合計サイズ警告閾値 (30 MB 以上で footer に注意喚起、送信は止めない) */
  warnTotalBytes: 30 * 1024 * 1024,
} as const;
