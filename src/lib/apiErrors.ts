import { formatAppError } from '@/lib/appErrors'

/** Preserve HTTP status and domain details; translate infrastructure failures at the boundary. */
export function apiErrorMessage(error: unknown, status: number, fallback: string) {
  const message = formatAppError(error instanceof SyntaxError
    ? 'The request is not valid JSON.'
    : error, fallback)
  // Detailed failures stay in server logs, including plain PostgREST error objects.
  if (status >= 500 || (error && typeof error === 'object' && 'code' in error)) {
    console.error('Request failed:', error)
  }
  return message
}
