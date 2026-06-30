# Roadmap: Passkeys / WebAuthn

This is a **planned** enhancement, deliberately NOT pseudo-implemented in the current hardening pass. TOTP MFA (Phase 1.6) is the stopgap.

## Why passkeys

TOTP codes are phishable (a user can be social-engineered into typing one into a fake site). Passkeys (WebAuthn/FIDO2) are **phishing-resistant**: the authenticator binds to the origin, so a credential minted for `taxdox.example.com` cannot be replayed on `taxd0x.evil`.

For a platform holding tax PII + payments, phishing resistance is the target end-state.

## Plan (Phase 2+)

1. **Credential model** — add a `Passkey` table: `userId`, `credentialId`, `publicKey`, `counter`, `transports`, `deviceType`. Migration is additive (expand), so safe under the migration strategy.
2. **Registration** — `POST /api/auth/passkey/register/begin` (generate challenge) → browser `navigator.credentials.create()` → `POST /api/auth/passkey/register/finish` (verify + store).
3. **Authentication** — `POST /api/auth/passkey/login/begin` → `navigator.credentials.get()` → `POST /api/auth/passkey/login/finish` (verify → issue JWT).
4. **Library:** `@simplewebauthn/server` + `@simplewebauthn/browser` (the maintained de-facto choice).
5. **Coexist with TOTP** — passkeys are an additional factor / passwordless option, not a forced replacement. MFA-enforcement flag (`FLAG_MFA_ENFORCE`) gates mandatory factors.
6. **Recovery** — keep backup codes + admin-reset path; lost passkey without recovery must not lock users out.

## Out of scope now

- Conditional UI / autofill (`mediation: 'conditional'`) — polish for later.
- Cross-device flows (hybrid transport) — supported by the library; just needs testing on the target devices.

## Tracking

Do not delete this doc; update it as WebAuthn lands. It is referenced from the threat model (`docs/threat-model.md` §S2 residual risk).
