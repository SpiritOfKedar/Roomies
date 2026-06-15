import axios from 'axios';

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data?.error;
    if (typeof apiError === 'string' && apiError.length > 0) {
      return apiError;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}
