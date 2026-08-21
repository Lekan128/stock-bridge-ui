export interface AppFieldError {
  field?: string
  message: string
}

/** Mirrors the backend's ProductRowError - row is 1-based (header = row 1), row 0 is file-level. */
export interface AppRowError {
  row: number
  column: string
  message: string
}

export interface AppError {
  status: number
  message: string
  errors?: AppFieldError[]
  rowErrors?: AppRowError[]
  /**
   * The `Retry-After` response header, in seconds, when the server sent one — 429s from the
   * verification-resend endpoint do. Absent when the header was missing *or* when the browser
   * hid it: `Retry-After` is not a CORS-safelisted response header, so a cross-origin caller
   * only sees it if the API lists it in `Access-Control-Expose-Headers`. Callers must therefore
   * treat this as a hint, never as a guarantee.
   */
  retryAfterSeconds?: number
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error &&
    typeof (error as AppError).message === 'string'
  )
}
