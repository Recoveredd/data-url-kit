import type { DataUrlDiagnostic } from './types.js';

export class DataUrlParseError extends Error {
  readonly diagnostic: DataUrlDiagnostic;

  constructor(diagnostic: DataUrlDiagnostic) {
    super(diagnostic.message);
    this.name = 'DataUrlParseError';
    this.diagnostic = diagnostic;
  }
}
