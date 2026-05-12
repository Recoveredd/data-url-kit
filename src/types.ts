export type DataUrlSeverity = 'warning' | 'error';

export type DataUrlDiagnosticCode =
  | 'NOT_A_STRING'
  | 'MISSING_DATA_SCHEME'
  | 'MISSING_COMMA'
  | 'EMPTY_MEDIA_TYPE_SEGMENT'
  | 'INVALID_MEDIA_TYPE'
  | 'INVALID_PARAMETER'
  | 'DUPLICATE_PARAMETER'
  | 'DUPLICATE_BASE64_FLAG'
  | 'INVALID_PERCENT_ENCODING'
  | 'INVALID_BASE64'
  | 'DATA_TOO_LARGE';

export interface DataUrlDiagnostic {
  code: DataUrlDiagnosticCode;
  severity: DataUrlSeverity;
  message: string;
  index?: number;
}

export interface DataUrlParseOptions {
  /**
   * Maximum decoded payload size in bytes. Useful when accepting user-provided
   * data URLs in previews, forms or docs tooling.
   */
  maxBytes?: number;
  /**
   * Accept whitespace in base64 payloads by stripping it before validation.
   *
   * @default true
   */
  allowBase64Whitespace?: boolean;
}

export interface DataUrlParameter {
  name: string;
  value: string;
}

export interface DataUrlInfo {
  mediaType: string;
  type: string;
  subtype: string;
  parameters: Record<string, string>;
  parameterList: DataUrlParameter[];
  isBase64: boolean;
  data: string;
  byteLength: number;
  bytes: Uint8Array;
  text?: string;
}

export interface DataUrlSuccess {
  ok: true;
  input: string;
  header: string;
  diagnostics: DataUrlDiagnostic[];
  value: DataUrlInfo;
}

export interface DataUrlFailure {
  ok: false;
  input: string;
  header?: string;
  diagnostics: DataUrlDiagnostic[];
}

export type DataUrlResult = DataUrlSuccess | DataUrlFailure;
