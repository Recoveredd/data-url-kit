import { DataUrlParseError } from './errors.js';
import type {
  DataUrlDiagnostic,
  DataUrlInfo,
  DataUrlParameter,
  DataUrlParseOptions,
  DataUrlResult
} from './types.js';

export { DataUrlParseError } from './errors.js';
export type {
  DataUrlDiagnostic,
  DataUrlDiagnosticCode,
  DataUrlFailure,
  DataUrlInfo,
  DataUrlParameter,
  DataUrlParseOptions,
  DataUrlResult,
  DataUrlSeverity,
  DataUrlSuccess
} from './types.js';

const DEFAULT_MEDIA_TYPE = 'text/plain';
const DEFAULT_CHARSET = 'US-ASCII';
const TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const TEXT_DECODER = typeof TextDecoder === 'undefined' ? undefined : new TextDecoder('utf-8', { fatal: true });

export function parseDataUrl(input: unknown, options: DataUrlParseOptions = {}): DataUrlResult {
  const diagnostics: DataUrlDiagnostic[] = [];

  if (typeof input !== 'string') {
    return fail(String(input), diagnostics, {
      code: 'NOT_A_STRING',
      severity: 'error',
      message: 'Data URL input must be a string.'
    });
  }

  if (input.slice(0, 5).toLowerCase() !== 'data:') {
    return fail(input, diagnostics, {
      code: 'MISSING_DATA_SCHEME',
      severity: 'error',
      message: 'Data URL must start with the "data:" scheme.',
      index: 0
    });
  }

  const commaIndex = input.indexOf(',');

  if (commaIndex === -1) {
    return fail(input, diagnostics, {
      code: 'MISSING_COMMA',
      severity: 'error',
      message: 'Data URL must contain a comma separating metadata from data.',
      index: input.length
    });
  }

  const header = input.slice(5, commaIndex);
  const rawData = input.slice(commaIndex + 1);
  const headerInfo = parseHeader(header, diagnostics);
  const dataInfo = headerInfo.isBase64
    ? decodeBase64Data(rawData, diagnostics, commaIndex + 1, options)
    : decodeUrlData(rawData, diagnostics, commaIndex + 1);

  if (dataInfo.bytes && options.maxBytes !== undefined && dataInfo.bytes.byteLength > options.maxBytes) {
    diagnostics.push({
      code: 'DATA_TOO_LARGE',
      severity: 'error',
      message: `Decoded data is ${dataInfo.bytes.byteLength} bytes, which exceeds the ${options.maxBytes} byte limit.`,
      index: commaIndex + 1
    });
  }

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

  if (errors.length > 0 || !dataInfo.bytes) {
    return {
      ok: false,
      input,
      header,
      diagnostics
    };
  }

  const value: DataUrlInfo = {
    mediaType: headerInfo.mediaType,
    type: headerInfo.type,
    subtype: headerInfo.subtype,
    parameters: headerInfo.parameters,
    parameterList: headerInfo.parameterList,
    isBase64: headerInfo.isBase64,
    data: rawData,
    byteLength: dataInfo.bytes.byteLength,
    bytes: dataInfo.bytes,
    ...(dataInfo.text !== undefined ? { text: dataInfo.text } : {})
  };

  return {
    ok: true,
    input,
    header,
    diagnostics,
    value
  };
}

export function isDataUrl(input: unknown, options?: DataUrlParseOptions): boolean {
  return parseDataUrl(input, options).ok;
}

export function explainDataUrl(input: unknown, options?: DataUrlParseOptions): DataUrlDiagnostic[] {
  return parseDataUrl(input, options).diagnostics;
}

export function parseDataUrlOrThrow(input: unknown, options?: DataUrlParseOptions): DataUrlInfo {
  const result = parseDataUrl(input, options);

  if (!result.ok) {
    throw new DataUrlParseError(result.diagnostics[0] ?? {
      code: 'MISSING_DATA_SCHEME',
      severity: 'error',
      message: 'Unable to parse data URL.'
    });
  }

  return result.value;
}

function parseHeader(header: string, diagnostics: DataUrlDiagnostic[]) {
  const parts = header.split(';');
  const mediaTypePart = parts[0] ?? '';
  const parameters: Record<string, string> = {};
  const parameterList: DataUrlParameter[] = [];
  let isBase64 = false;
  let mediaType = DEFAULT_MEDIA_TYPE;
  let type = 'text';
  let subtype = 'plain';

  if (mediaTypePart !== '') {
    const parsed = parseMediaType(mediaTypePart);

    if (!parsed) {
      diagnostics.push({
        code: 'INVALID_MEDIA_TYPE',
        severity: 'error',
        message: `Invalid media type "${mediaTypePart}".`,
        index: 5
      });
    } else {
      mediaType = parsed.mediaType;
      type = parsed.type;
      subtype = parsed.subtype;
    }
  }

  let partOffset = 5 + mediaTypePart.length + 1;

  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index] ?? '';
    const currentOffset = partOffset;
    partOffset += part.length + 1;

    if (part === '') {
      diagnostics.push({
        code: 'EMPTY_MEDIA_TYPE_SEGMENT',
        severity: 'warning',
        message: 'Empty metadata segment was ignored.',
        index: currentOffset
      });
      continue;
    }

    if (part.toLowerCase() === 'base64') {
      if (isBase64) {
        diagnostics.push({
          code: 'DUPLICATE_BASE64_FLAG',
          severity: 'error',
          message: 'Data URL contains the base64 flag more than once.',
          index: currentOffset
        });
      }

      isBase64 = true;
      continue;
    }

    const separator = part.indexOf('=');

    if (separator <= 0) {
      diagnostics.push({
        code: 'INVALID_PARAMETER',
        severity: 'error',
        message: `Invalid media type parameter "${part}".`,
        index: currentOffset
      });
      continue;
    }

    const name = part.slice(0, separator).toLowerCase();
    const value = part.slice(separator + 1);

    if (!TOKEN_PATTERN.test(name) || value === '') {
      diagnostics.push({
        code: 'INVALID_PARAMETER',
        severity: 'error',
        message: `Invalid media type parameter "${part}".`,
        index: currentOffset
      });
      continue;
    }

    if (Object.hasOwn(parameters, name)) {
      diagnostics.push({
        code: 'DUPLICATE_PARAMETER',
        severity: 'warning',
        message: `Duplicate parameter "${name}" keeps the last value.`,
        index: currentOffset
      });
    }

    parameters[name] = value;
    parameterList.push({ name, value });
  }

  if (!Object.hasOwn(parameters, 'charset') && mediaType === DEFAULT_MEDIA_TYPE) {
    parameters.charset = DEFAULT_CHARSET;
    parameterList.push({ name: 'charset', value: DEFAULT_CHARSET });
  }

  return {
    mediaType,
    type,
    subtype,
    parameters,
    parameterList,
    isBase64
  };
}

function parseMediaType(value: string): { mediaType: string; type: string; subtype: string } | undefined {
  const slash = value.indexOf('/');

  if (slash <= 0 || slash === value.length - 1) {
    return undefined;
  }

  const type = value.slice(0, slash).toLowerCase();
  const subtype = value.slice(slash + 1).toLowerCase();

  if (!TOKEN_PATTERN.test(type) || !TOKEN_PATTERN.test(subtype)) {
    return undefined;
  }

  return {
    mediaType: `${type}/${subtype}`,
    type,
    subtype
  };
}

function decodeUrlData(
  value: string,
  diagnostics: DataUrlDiagnostic[],
  offset: number
): { bytes?: Uint8Array; text?: string } {
  const bytes: number[] = [];
  const chunks: Uint8Array[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? '';

    if (char === '%') {
      const hex = value.slice(index + 1, index + 3);

      if (!/^[0-9A-Fa-f]{2}$/.test(hex)) {
        diagnostics.push({
          code: 'INVALID_PERCENT_ENCODING',
          severity: 'error',
          message: 'Percent-encoded data must use two hexadecimal digits.',
          index: offset + index
        });
        return {};
      }

      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }

    const code = value.codePointAt(index) ?? 0;

    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }

    const encoded = encodeCodePoint(code);
    chunks.push(Uint8Array.from(bytes));
    chunks.push(encoded);
    bytes.length = 0;

    if (code > 0xffff) {
      index += 1;
    }
  }

  chunks.push(Uint8Array.from(bytes));
  const decodedBytes = concatBytes(chunks);

  return {
    bytes: decodedBytes,
    text: decodeText(decodedBytes)
  };
}

function decodeBase64Data(
  value: string,
  diagnostics: DataUrlDiagnostic[],
  offset: number,
  options: DataUrlParseOptions
): { bytes?: Uint8Array; text?: string } {
  const decoded = decodeUrlData(value, diagnostics, offset);

  if (!decoded.bytes) {
    return {};
  }

  if (decoded.text === undefined) {
    diagnostics.push({
      code: 'INVALID_BASE64',
      severity: 'error',
      message: 'Base64 data must be ASCII after percent-decoding.',
      index: offset
    });
    return {};
  }

  const normalized = options.allowBase64Whitespace === false ? decoded.text : decoded.text.replace(/\s+/g, '');

  if (!BASE64_PATTERN.test(normalized)) {
    diagnostics.push({
      code: 'INVALID_BASE64',
      severity: 'error',
      message: 'Base64 data is malformed.',
      index: offset
    });
    return {};
  }

  const bytes = base64ToBytes(normalized);

  return {
    bytes,
    text: decodeText(bytes)
  };
}

function base64ToBytes(value: string): Uint8Array {
  if (value === '') {
    return new Uint8Array();
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/=+$/, '');
  const outputLength = Math.floor((clean.length * 6) / 8);
  const output = new Uint8Array(outputLength);
  let buffer = 0;
  let bits = 0;
  let outputIndex = 0;

  for (const char of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output[outputIndex] = (buffer >> bits) & 0xff;
      outputIndex += 1;
    }
  }

  return output;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

function encodeCodePoint(code: number): Uint8Array {
  if (code <= 0x7ff) {
    return Uint8Array.of(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
  }

  if (code <= 0xffff) {
    return Uint8Array.of(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }

  return Uint8Array.of(
    0xf0 | (code >> 18),
    0x80 | ((code >> 12) & 0x3f),
    0x80 | ((code >> 6) & 0x3f),
    0x80 | (code & 0x3f)
  );
}

function decodeText(bytes: Uint8Array): string | undefined {
  try {
    return TEXT_DECODER?.decode(bytes);
  } catch {
    return undefined;
  }
}

function fail(
  input: string,
  diagnostics: DataUrlDiagnostic[],
  diagnostic: DataUrlDiagnostic
): DataUrlResult {
  diagnostics.push(diagnostic);

  return {
    ok: false,
    input,
    diagnostics
  };
}
