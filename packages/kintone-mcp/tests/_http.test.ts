import { describe, expect, it } from 'vitest';

import { isValidResourceId, maskToken, sanitizeError, sanitizeText } from '../src/_http';

describe('isValidResourceId', () => {
  it('英数字 / _ / - は通る', () => {
    expect(isValidResourceId('vlt_abc-123')).toBe(true);
    expect(isValidResourceId('vcrd_XYZ')).toBe(true);
  });

  it('/ や .. を含むと false (パストラバーサル防止)', () => {
    expect(isValidResourceId('vlt/../foo')).toBe(false);
    expect(isValidResourceId('a/b')).toBe(false);
    expect(isValidResourceId('..')).toBe(false);
  });

  it('空文字 / 非文字列は false', () => {
    expect(isValidResourceId('')).toBe(false);
    expect(isValidResourceId(null)).toBe(false);
    expect(isValidResourceId(123)).toBe(false);
  });
});

describe('sanitizeError / sanitizeText', () => {
  it('Anthropic API key を伏字にする', () => {
    const msg = 'request failed with key sk-ant-api03-AbCdEf_12-34xyz tail';
    expect(sanitizeError(new Error(msg))).toBe('request failed with key [REDACTED] tail');
  });

  it('Bearer トークンを伏字にする', () => {
    expect(sanitizeText('Authorization: Bearer abc.def-123~xyz')).toBe('Authorization: [REDACTED]');
  });

  it('JWT 様の文字列を伏字にする', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcDEF';
    expect(sanitizeText(`token=${jwt}`)).toBe('token=[REDACTED]');
  });

  it('秘匿情報が無ければそのまま返す', () => {
    expect(sanitizeError(new Error('not found'))).toBe('not found');
    expect(sanitizeError('plain string')).toBe('plain string');
  });
});

describe('maskToken', () => {
  it('16 文字以下は長さのみ', () => {
    expect(maskToken('shorttoken')).toBe('(len=10)');
  });

  it('長いトークンは先頭 8 + 末尾 4', () => {
    expect(maskToken('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefgh...wxyz (len=26)');
  });
});
