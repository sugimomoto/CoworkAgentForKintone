// 画像ファイルのマジックバイト検出。
//
// 拡張子だけ信用すると、ユーザーが ".png" と命名しつつ実体は AVIF / HEIC な
// ファイルを送ってくる場合がある (macOS Preview / ブラウザ DnD のクセ)。
// Anthropic API は image/png / image/jpeg / image/gif / image/webp のみ対応で、
// AVIF / HEIC は宣言した media_type と中身が違うと弾かれる。
//
// 本モジュールは base64 文字列の先頭数バイトをデコードして実形式を判定する。
// File オブジェクトを再読込せず、既に取得済みの base64 をそのまま使える。

/** Anthropic がサポートする image MIME */
export type SupportedImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export type DetectedImageFormat =
  | { kind: 'supported'; mime: SupportedImageMime }
  | { kind: 'unsupported'; label: string }  // AVIF / HEIC 等
  | { kind: 'unknown' };

/**
 * base64 文字列の先頭バイトから画像形式を推定する。
 * 数十バイトしか必要ないので decode コストは無視できる。
 */
export function detectImageFormat(base64: string): DetectedImageFormat {
  if (!base64) return { kind: 'unknown' };
  // 先頭 24 byte (= base64 で約 32 文字) だけ atob する
  const head = base64.slice(0, 32);
  let bytes: Uint8Array;
  try {
    const bin = atob(head);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return { kind: 'unknown' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { kind: 'supported', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: 'supported', mime: 'image/jpeg' };
  }
  // GIF: 47 49 46 38 (GIF87a / GIF89a)
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return { kind: 'supported', mime: 'image/gif' };
  }
  // WebP: RIFF....WEBP (4 byte RIFF + 4 byte size + 4 byte WEBP)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { kind: 'supported', mime: 'image/webp' };
  }
  // ISO BMFF コンテナ系 (AVIF / HEIC / HEIF / MP4): ?? ?? ?? ?? "ftyp" (offset 4)
  if (
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    // brand 文字列 (offset 8〜11) で判別
    const brand = String.fromCharCode(
      bytes[8] ?? 0,
      bytes[9] ?? 0,
      bytes[10] ?? 0,
      bytes[11] ?? 0,
    ).toLowerCase();
    if (brand.startsWith('avif') || brand === 'avis') return { kind: 'unsupported', label: 'AVIF' };
    if (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1') || brand.startsWith('msf1')) {
      return { kind: 'unsupported', label: 'HEIC/HEIF' };
    }
    return { kind: 'unsupported', label: brand.toUpperCase() };
  }

  return { kind: 'unknown' };
}
