// 添付ファイルのバリデーション。
// チップを赤表示にする errorText もここで生成する。

import { EXTENSION_TO_KIND, FILE_LIMITS, SUPPORTED_EXTENSIONS } from './types';

/**
 * ファイル名から拡張子を抽出する (小文字化)。
 *   "report.pdf" → "pdf"
 *   "photo.JPG"  → "jpg"
 *   "no-dot"     → "" (拡張子なし扱い)
 *   ".dotfile"   → "" (隠しファイルは拡張子なし扱い)
 */
export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0) return ''; // idx===0 (隠しファイル) も拡張子なし
  return filename.slice(idx + 1).toLowerCase();
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * 1 ファイルを検証する。
 *
 * @param file 添付候補のファイル
 * @param currentCount 現時点で添付済のファイル数 (本ファイルを足す前)
 */
export function validateFile(file: File, currentCount: number): ValidationResult {
  const ext = extensionOf(file.name);
  if (!ext || !EXTENSION_TO_KIND[ext]) {
    return {
      ok: false,
      reason: ext
        ? `未対応の拡張子です (.${ext})`
        : `未対応のファイルです (拡張子なし)`,
    };
  }
  if (file.size > FILE_LIMITS.perFileBytes) {
    const limitMb = Math.round(FILE_LIMITS.perFileBytes / 1024 / 1024);
    return { ok: false, reason: `サイズ上限 (${limitMb} MB) を超えています` };
  }
  if (currentCount >= FILE_LIMITS.maxFilesPerMessage) {
    return {
      ok: false,
      reason: `添付は最大 ${FILE_LIMITS.maxFilesPerMessage} 件までです`,
    };
  }
  return { ok: true };
}

/** ホワイトリストに対応する MIME 一覧 (kind 重複あり) — テスト用 */
export const SUPPORTED_MIMES = SUPPORTED_EXTENSIONS.map((e) => EXTENSION_TO_KIND[e]!.mime);
