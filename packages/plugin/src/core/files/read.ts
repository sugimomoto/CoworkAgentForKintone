// File reading helpers — FileReader を Promise 化したラッパ。
//
// readAsBase64 は readAsDataURL → `,` 以降を抽出する形で実装する。
// `readAsArrayBuffer + btoa(String.fromCharCode(...))` パターンは数 MB 級で
// stack overflow を起こすため使わない (ブラウザ実装に base64 化を任せる方が安全)。

/** UTF-8 で文字列としてデコードする (CSV / Markdown / JSON / TXT 用) */
export async function readAsText(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(r.error ?? new Error('FileReader error'));
    r.readAsText(file, 'utf-8');
  });
}

/**
 * バイナリを base64 文字列にエンコードする (PDF / 画像用)。
 * `data:<mime>;base64,<payload>` の payload 部だけを返す (Anthropic API の
 * `source.data` フィールドが prefix 不要の純 base64 を要求するため)。
 */
export async function readAsBase64(file: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(r.error ?? new Error('FileReader error'));
    r.readAsDataURL(file);
  });
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : '';
}
