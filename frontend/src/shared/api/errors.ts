/**
 * Типизированная ошибка API — бросается из `client.ts` при non-2xx ответе.
 * Код компонентов должен проверять `instanceof ApiError` или просто `err.status`.
 */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Type guard для отличия ApiError от обычных ошибок.
 */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
