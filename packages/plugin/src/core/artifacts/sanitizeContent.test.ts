import { describe, it, expect } from 'vitest';

import {
  sanitizeHtmlContent,
  sanitizeMermaidContent,
  sanitizeSvgContent,
  stripCodeFences,
  stripXmlPreamble,
} from './sanitizeContent';

describe('stripCodeFences', () => {
  it('```svg ... ``` を剥がす', () => {
    expect(stripCodeFences('```svg\n<svg></svg>\n```')).toBe('<svg></svg>');
  });
  it('言語ヒントなしのフェンスも剥がす', () => {
    expect(stripCodeFences('```\n<div></div>\n```')).toBe('<div></div>');
  });
  it('フェンスがなければそのまま', () => {
    expect(stripCodeFences('<svg></svg>')).toBe('<svg></svg>');
  });
  it('前後に空白があってもフェンスを認識する', () => {
    expect(stripCodeFences('  ```mermaid\ngraph TD; A-->B;\n```  ')).toBe('graph TD; A-->B;');
  });
});

describe('stripXmlPreamble', () => {
  it('<?xml ... ?> を剥がす', () => {
    expect(stripXmlPreamble('<?xml version="1.0"?>\n<svg></svg>')).toBe('<svg></svg>');
  });
  it('<!DOCTYPE ...> を剥がす', () => {
    expect(stripXmlPreamble('<!DOCTYPE svg PUBLIC ...>\n<svg></svg>')).toBe('<svg></svg>');
  });
  it('両方ある場合も剥がす', () => {
    expect(stripXmlPreamble('<?xml version="1.0"?><!DOCTYPE svg>\n<svg></svg>')).toBe(
      '<svg></svg>',
    );
  });
});

describe('sanitizeSvgContent', () => {
  it('フェンス + XML 宣言 を一括で剥がす', () => {
    const input = '```svg\n<?xml version="1.0"?>\n<svg viewBox="0 0 10 10"></svg>\n```';
    expect(sanitizeSvgContent(input)).toBe('<svg viewBox="0 0 10 10"></svg>');
  });

  it('前置き文 + 末尾文がある場合でも <svg>...</svg> だけを抽出する', () => {
    const input = 'Here is the SVG:\n<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3"/></svg>\nLet me know if you need adjustments.';
    expect(sanitizeSvgContent(input)).toBe(
      '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3"/></svg>',
    );
  });
});

describe('sanitizeHtmlContent / sanitizeMermaidContent', () => {
  it('HTML はフェンスのみ剥がす', () => {
    expect(sanitizeHtmlContent('```html\n<div>x</div>\n```')).toBe('<div>x</div>');
  });
  it('Mermaid もフェンスのみ剥がす', () => {
    expect(sanitizeMermaidContent('```mermaid\ngraph TD; A-->B;\n```')).toBe('graph TD; A-->B;');
  });
});
