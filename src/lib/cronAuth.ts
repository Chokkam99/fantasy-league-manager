export function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  cronSecret: string | undefined,
) {
  if (!cronSecret) return false

  return authorizationHeader === `Bearer ${cronSecret}`
}
