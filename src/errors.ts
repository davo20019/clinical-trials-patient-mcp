export class InvalidInputError extends Error {
  readonly code = "INVALID_INPUT";
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UpstreamError extends Error {
  readonly code = "UPSTREAM_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export type KnownError =
  | InvalidInputError
  | NotFoundError
  | UpstreamError
  | RateLimitError;

export function isKnownError(e: unknown): e is KnownError {
  return (
    e instanceof InvalidInputError ||
    e instanceof NotFoundError ||
    e instanceof UpstreamError ||
    e instanceof RateLimitError
  );
}
