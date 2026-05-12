# data-url-kit

[![npm version](https://img.shields.io/npm/v/data-url-kit.svg)](https://www.npmjs.com/package/data-url-kit)
[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Recoveredd/data-url-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/Recoveredd/data-url-kit/actions/workflows/ci.yml)

Parse, validate and inspect `data:` URLs with typed diagnostics.

`data-url-kit` is a small clean-room toolkit for apps, docs tools and support dashboards that need
to explain why a data URL is valid or invalid. It returns MIME information, parameters, byte length,
decoded bytes, decoded text when possible, and diagnostics that are easy to show in a UI.

Links: [npm](https://www.npmjs.com/package/data-url-kit) · [GitHub](https://github.com/Recoveredd/data-url-kit)

Use `data-urls` when you need a mature WHATWG-oriented parser for platform-level behavior. Use
`data-url-kit` when you need a lightweight inspector, validator or playground with readable errors.

## Package quality

- TypeScript types are generated from the source.
- ESM-only package with no runtime dependencies.
- Marked as side-effect free for bundlers.
- Tested on Node.js 20 and 22 with GitHub Actions.
- Browser-friendly implementation with `Uint8Array` output.

## Install

```bash
npm install data-url-kit
```

## Quick Start

```ts
import { parseDataUrl } from "data-url-kit";

const result = parseDataUrl("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D");

if (result.ok) {
  result.value.mediaType;
  // "text/plain"

  result.value.isBase64;
  // true

  result.value.text;
  // "Hello, World!"

  result.value.byteLength;
  // 13
} else {
  result.diagnostics;
}
```

## Why not just another data URL parser?

The common alternatives are good at either validating or parsing:

- `valid-data-url` returns a boolean.
- `parse-data-url` returns a parsed object.
- `data-urls` is the best fit for WHATWG/platform-level parsing.

`data-url-kit` focuses on inspection:

- typed diagnostics instead of only `true` / `false`;
- warnings that can be displayed without rejecting the URL;
- explicit byte length for preview limits;
- decoded `Uint8Array` for browser and Node usage;
- decoded text when bytes are valid UTF-8;
- safe helpers for forms, playgrounds and docs dashboards.

## API

### `parseDataUrl(input, options?)`

Returns a discriminated result.

```ts
import { parseDataUrl } from "data-url-kit";

const result = parseDataUrl("data:,Hello%20World");

if (result.ok) {
  console.log(result.value);
} else {
  console.log(result.diagnostics);
}
```

`ok: true` means no blocking error was found. The `diagnostics` array can still contain warnings
such as duplicated parameters or ignored empty metadata segments.

Result shape:

```ts
type DataUrlResult =
  | {
      ok: true;
      input: string;
      header: string;
      diagnostics: DataUrlDiagnostic[];
      value: DataUrlInfo;
    }
  | {
      ok: false;
      input: string;
      header?: string;
      diagnostics: DataUrlDiagnostic[];
    };
```

Parsed value:

```ts
type DataUrlInfo = {
  mediaType: string;
  type: string;
  subtype: string;
  parameters: Record<string, string>;
  parameterList: Array<{ name: string; value: string }>;
  isBase64: boolean;
  data: string;
  byteLength: number;
  bytes: Uint8Array;
  text?: string;
};
```

Options:

| Option | Default | Description |
| --- | --- | --- |
| `maxBytes` | none | Reject decoded payloads larger than this byte limit. |
| `allowBase64Whitespace` | `true` | Strip whitespace before base64 validation. |

### `isDataUrl(input, options?)`

Returns a boolean.

```ts
import { isDataUrl } from "data-url-kit";

isDataUrl("data:,Hello");
// true
```

### `explainDataUrl(input, options?)`

Returns only diagnostics.

```ts
import { explainDataUrl } from "data-url-kit";

explainDataUrl("data:text/plain,Hello%XX");
// [{ code: "INVALID_PERCENT_ENCODING", severity: "error", ... }]
```

### `parseDataUrlOrThrow(input, options?)`

Returns the parsed value or throws `DataUrlParseError`.

```ts
import { parseDataUrlOrThrow } from "data-url-kit";

const info = parseDataUrlOrThrow("data:,Hello");
```

## Diagnostics

Diagnostics are designed for UI display.

| Code | Severity | Meaning |
| --- | --- | --- |
| `NOT_A_STRING` | `error` | Runtime input was not a string. |
| `MISSING_DATA_SCHEME` | `error` | Input does not start with `data:`. |
| `MISSING_COMMA` | `error` | Metadata and data are not separated by a comma. |
| `EMPTY_MEDIA_TYPE_SEGMENT` | `warning` | An empty metadata segment was ignored. |
| `INVALID_MEDIA_TYPE` | `error` | MIME type is malformed. |
| `INVALID_PARAMETER` | `error` | Media type parameter is malformed. |
| `DUPLICATE_PARAMETER` | `warning` | A repeated parameter keeps the last value. |
| `DUPLICATE_BASE64_FLAG` | `error` | `;base64` appears more than once. |
| `INVALID_PERCENT_ENCODING` | `error` | Percent encoding is malformed. |
| `INVALID_BASE64` | `error` | Base64 payload is malformed. |
| `DATA_TOO_LARGE` | `error` | Decoded payload exceeds `maxBytes`. |

## Notes

- This package does not fetch or execute data URLs.
- It is intentionally pragmatic and inspector-oriented, not a full browser URL implementation.
- `text` is decoded as UTF-8 when possible; use `bytes` when exact binary data matters.
- Default media type follows the common `text/plain;charset=US-ASCII` behavior for `data:,...`.
- Use `data-urls` if you need a broader WHATWG parser.
- The implementation is clean-room and does not copy code from `valid-data-url`, `parse-data-url`,
  `data-urls` or related packages.

## License

MPL-2.0
