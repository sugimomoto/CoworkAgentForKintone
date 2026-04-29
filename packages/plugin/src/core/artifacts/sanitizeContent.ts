// LLM が create_artifact に渡してくる content の典型的なノイズを取り除く。
// 絶対に必要な処理ではないが、プロンプトを守らない出力 (コードフェンス / XML 宣言 / DOCTYPE) を
// 自動で剥がしてレンダラに渡しやすくする。

/**
 * 先頭・末尾の markdown コードフェンス (```svg ... ``` 形式) を取り除く。
 * フェンスのみのとき (```mermaid\n graph TD; A-->B; \n```) を想定。
 * 中身に ``` が含まれる場合は剥がさない (コード例の場合)。
 */
export function stripCodeFences(content: string): string {
  const trimmed = content.trim();
  // ``` で始まる + ``` で終わる
  const fenceMatch = /^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```\s*$/m.exec(trimmed);
  if (fenceMatch && typeof fenceMatch[1] === 'string') {
    return fenceMatch[1].trim();
  }
  return content;
}

/**
 * SVG コンテンツから XML 宣言と DOCTYPE を除去する。
 * iframe の HTML body 内に置く都合上、これらは invalid (もしくは害) なので外す。
 */
export function stripXmlPreamble(svg: string): string {
  return svg
    .replace(/^\s*<\?xml[^>]*\?>\s*/i, '')
    .replace(/^\s*<!DOCTYPE[^>]*>\s*/i, '')
    .trimStart();
}

/**
 * テキストから最初の `<svg>...</svg>` ブロックを抽出する。
 * Agent が前置き文 ("Here is the SVG:" 等) を混ぜて返してくるケースを救済する。
 * 見つからなければ元の文字列を返す。
 */
export function extractSvgBlock(text: string): string {
  const match = /<svg[\s\S]*?<\/svg>/i.exec(text);
  return match ? match[0] : text;
}

/** SVG 用の総合サニタイズ */
export function sanitizeSvgContent(content: string): string {
  return extractSvgBlock(stripXmlPreamble(stripCodeFences(content)));
}

/** HTML 用の総合サニタイズ (フェンスのみ除去。DOCTYPE は HtmlArtifact 側でハンドリング) */
export function sanitizeHtmlContent(content: string): string {
  return stripCodeFences(content);
}

/** Mermaid 用 */
export function sanitizeMermaidContent(content: string): string {
  return stripCodeFences(content);
}
