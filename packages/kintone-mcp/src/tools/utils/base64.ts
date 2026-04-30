// base64 ⇄ Uint8Array 変換ユーティリティ。Cloudflare Workers の標準 atob/btoa を使用。
//
// 大きいバイナリで btoa(String.fromCharCode(...arr)) を一発で呼ぶと call stack が
// 詰まるので、チャンク単位で binary string を組み立てる。

const CHUNK = 0x8000;

export function base64ToBytes(b64: string): Uint8Array {
  const cleaned = b64.replace(/\s+/g, '');
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    bin += String.fromCharCode(...slice);
  }
  return btoa(bin);
}
