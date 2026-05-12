import { describe, expect, it } from 'vitest';
import {
  DataUrlParseError,
  explainDataUrl,
  getDataUrlMediaType,
  isBase64DataUrl,
  isDataUrl,
  parseDataUrl,
  parseDataUrlOrThrow
} from '../src/index.js';

describe('data-url-kit', () => {
  it('parses a minimal text data URL', () => {
    const result = parseDataUrl('data:,Hello%2C%20World!');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected data URL to parse.');
    }

    expect(result.value.mediaType).toBe('text/plain');
    expect(result.value.parameters.charset).toBe('US-ASCII');
    expect(result.value.isBase64).toBe(false);
    expect(result.value.byteLength).toBe(13);
    expect(result.value.text).toBe('Hello, World!');
  });

  it('parses base64 data including percent-encoded padding', () => {
    const result = parseDataUrl('data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected base64 data URL to parse.');
    }

    expect(result.value.mediaType).toBe('text/plain');
    expect(result.value.isBase64).toBe(true);
    expect(result.value.text).toBe('Hello, World!');
  });

  it('omits text when decoded bytes are not valid UTF-8', () => {
    const result = parseDataUrl('data:application/octet-stream,%FF%00%01');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected binary data URL to parse.');
    }

    expect(result.value.byteLength).toBe(3);
    expect(result.value.bytes).toEqual(Uint8Array.of(0xff, 0x00, 0x01));
    expect(result.value.text).toBeUndefined();
  });

  it('keeps explicit parameters and reports duplicates as warnings', () => {
    const result = parseDataUrl('data:image/svg+xml;charset=UTF-8;charset=utf-8,%3Csvg%2F%3E');

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('Expected parameterized data URL to parse.');
    }

    expect(result.value.type).toBe('image');
    expect(result.value.subtype).toBe('svg+xml');
    expect(result.value.parameters.charset).toBe('utf-8');
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'DUPLICATE_PARAMETER',
        severity: 'warning'
      })
    ]);
  });

  it('returns diagnostics for invalid data URLs', () => {
    expect(parseDataUrl('https://example.com')).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [expect.objectContaining({ code: 'MISSING_DATA_SCHEME' })]
      })
    );

    expect(parseDataUrl('data:text/plain')).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [expect.objectContaining({ code: 'MISSING_COMMA' })]
      })
    );

    expect(parseDataUrl('data:text/plain,Hello%XX')).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [expect.objectContaining({ code: 'INVALID_PERCENT_ENCODING' })]
      })
    );
  });

  it('validates base64 payloads', () => {
    const result = parseDataUrl('data:text/plain;base64,%%%%');

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'INVALID_PERCENT_ENCODING')).toBe(true);

    const malformed = parseDataUrl('data:text/plain;base64,abc');
    expect(malformed.ok).toBe(false);
    expect(malformed.diagnostics.some((diagnostic) => diagnostic.code === 'INVALID_BASE64')).toBe(true);

    const nonAscii = parseDataUrl('data:text/plain;base64,%FF');
    expect(nonAscii.ok).toBe(false);
    expect(nonAscii.diagnostics.some((diagnostic) => diagnostic.code === 'INVALID_BASE64')).toBe(true);
  });

  it('can reject whitespace in base64 payloads', () => {
    expect(parseDataUrl('data:text/plain;base64,SGVs bG8=')).toEqual(expect.objectContaining({ ok: true }));

    const strict = parseDataUrl('data:text/plain;base64,SGVs bG8=', { allowBase64Whitespace: false });

    expect(strict.ok).toBe(false);
    expect(strict.diagnostics).toContainEqual(expect.objectContaining({ code: 'INVALID_BASE64' }));
  });

  it('enforces maxBytes limits', () => {
    const result = parseDataUrl('data:,Hello', { maxBytes: 3 });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'DATA_TOO_LARGE' }));
  });

  it('offers boolean and diagnostic helpers', () => {
    expect(isDataUrl('data:,ok')).toBe(true);
    expect(isDataUrl('nope')).toBe(false);
    expect(explainDataUrl('nope')).toContainEqual(expect.objectContaining({ code: 'MISSING_DATA_SCHEME' }));
  });

  it('offers quick metadata helpers', () => {
    expect(getDataUrlMediaType('data:image/svg+xml,%3Csvg%2F%3E')).toBe('image/svg+xml');
    expect(getDataUrlMediaType('nope')).toBeUndefined();
    expect(isBase64DataUrl('data:text/plain;base64,SGVsbG8=')).toBe(true);
    expect(isBase64DataUrl('data:text/plain,Hello')).toBe(false);
  });

  it('throws with parseDataUrlOrThrow', () => {
    expect(parseDataUrlOrThrow('data:,ok').text).toBe('ok');
    expect(() => parseDataUrlOrThrow('nope')).toThrow(DataUrlParseError);
  });

  it('reports non-string inputs at runtime', () => {
    const result = parseDataUrl(null);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'NOT_A_STRING' }));
  });
});
