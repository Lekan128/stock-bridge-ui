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
