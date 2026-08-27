#!/bin/sh

set -eu

keychain_service='fantasy-league-manager'
session_keychain_account='ADMIN_SESSION_SECRET'
password_keychain_account='ADMIN_PASSWORD_HASH'

if ! command -v security >/dev/null 2>&1; then
  echo 'macOS Keychain is unavailable. Use npm run dev with ADMIN_SESSION_SECRET set securely.' >&2
  exit 1
fi

if ! admin_session_secret="$(
  security find-generic-password \
    -w \
    -s "$keychain_service" \
    -a "$session_keychain_account"
)"; then
  echo 'ADMIN_SESSION_SECRET was not found in macOS Keychain.' >&2
  exit 1
fi

if [ "${#admin_session_secret}" -lt 32 ]; then
  echo 'The Keychain ADMIN_SESSION_SECRET must contain at least 32 characters.' >&2
  exit 1
fi

ADMIN_SESSION_SECRET="$admin_session_secret"
export ADMIN_SESSION_SECRET

if admin_password_hash="$(
  security find-generic-password \
    -w \
    -s "$keychain_service" \
    -a "$password_keychain_account" \
    2>/dev/null
)"; then
  case "$admin_password_hash" in
    scrypt.v1.32768.8.3.*)
      ADMIN_PASSWORD_HASH="$admin_password_hash"
      export ADMIN_PASSWORD_HASH
      ;;
    *)
      echo 'The Keychain ADMIN_PASSWORD_HASH is not a supported scrypt verifier.' >&2
      exit 1
      ;;
  esac
fi

exec npm run dev
