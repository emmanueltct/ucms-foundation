export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * Standard response envelope used by every UCMS endpoint.
 * Exactly one of `data` / `error` should be populated.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta: ApiMeta | null;
  error: ApiError | null;
}

export function ok<T>(data: T, meta: ApiMeta | null = null): ApiResponse<T> {
  return { success: true, data, meta, error: null };
}

export function fail(code: string, message: string, details?: Record<string, unknown>): ApiResponse<null> {
  return { success: false, data: null, meta: null, error: { code, message, details } };
}
