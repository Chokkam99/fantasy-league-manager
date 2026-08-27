# Commissioner authentication

Commissioner access uses two independent server-only values:

- `ADMIN_PASSWORD_HASH` verifies the submitted password with versioned scrypt.
- `ADMIN_SESSION_SECRET` signs random, expiring, HTTP-only session cookies.

Neither value may use a `NEXT_PUBLIC_` prefix. The password itself is never stored, sent back to the browser, or placed in the session cookie.

## Password-verifier format

The supported format is `scrypt.v1.32768.8.3.<salt>.<derived-key>`. It uses Node's asynchronous scrypt implementation, a random 16-byte salt, a 32-byte derived key, `N=32768`, `r=8`, and `p=3`. This is one of the minimum-equivalent scrypt configurations in the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Node documents the parameter behavior and recommends a unique salt of at least 16 bytes in its [crypto API](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).

Generate a verifier through a hidden interactive prompt:

```sh
npm run admin:hash-password
```

The command prints only the resulting `ADMIN_PASSWORD_HASH` assignment. Add it as a protected server environment value in preview or production. Do not commit it.

For local macOS development, store the verifier directly in Keychain without printing it:

```sh
npm run admin:password:keychain
npm run admin:session:keychain
npm run dev:keychain
```

The Keychain items use service `fantasy-league-manager` and accounts `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET`. `dev:keychain` loads them only into the Next.js process. If the password-hash item is absent, normal `.env` loading remains available; the session-secret item is required by the loader.

For a hosted environment, generate the session assignment without Keychain:

```sh
npm run admin:session-secret
```

This prints the new assignment once so it can be stored in the deployment provider's protected environment settings. Do not reuse the local value.

## Legacy transition

The original short custom hash is disabled by default. A deployment that has not yet replaced it receives `503` at login rather than silently using the weak verifier.

For a short, deliberate transition only, set:

```sh
ALLOW_LEGACY_ADMIN_PASSWORD_HASH=true
```

This flag accepts only the old verifier for login; sessions still use the signed session format. Remove the flag as soon as a scrypt verifier is installed. Preview and production release approval should require a scrypt-prefixed `ADMIN_PASSWORD_HASH` and no legacy opt-in.

Changing `ADMIN_PASSWORD_HASH` does not invalidate an already issued session. Rotate `ADMIN_SESSION_SECRET` as well when immediate session invalidation is required.
