export interface StructuredToolErrorPayload {
  error: string;
  message: string;
  [key: string]: unknown;
}

export class StructuredToolError extends Error {
  readonly payload: StructuredToolErrorPayload;

  constructor(payload: StructuredToolErrorPayload) {
    super(payload.message);
    this.name = "StructuredToolError";
    this.payload = payload;
  }
}
