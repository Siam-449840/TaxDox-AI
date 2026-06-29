# ADR-005: Object Storage via Cloudflare R2

## Status
Accepted

## Context
Uploaded documents are written to the **local filesystem** (`download/uploads`) at `process.cwd()` across 7 touchpoints in 4 routes. On serverless/ephemeral infrastructure this data is **lost on every redeploy/restart**, cannot scale across instances, and cannot be backed up or scanned centrally. Tax documents are sensitive PII, so storage must be durable, encrypted at rest, access-controlled, and auditable.

## Decision
Adopt an **`ObjectStore` abstraction** (`src/lib/object-store.ts`) with two implementations:
1. **`R2Store`** (production) — Cloudflare R2 via the S3-compatible API (`@aws-sdk/client-s3`). Zero egress fees, S3-compatible, durable.
2. **`LocalStore`** (development fallback) — current `download/uploads` behavior.

Selection via `STORAGE_DRIVER` env (`r2` | `local`, default `local`). The interface is deliberately richer than put/get:

```ts
interface ObjectStore {
  put(key, buffer, opts): Promise<StoredObject>      // multipart for large, SHA-256 checksum
  get(key): Promise<Buffer>
  delete(key): Promise<void>
  getSignedUrl(key, ttl): Promise<string>
  onStored?(obj): Promise<void>                       // pluggable hook (e.g. virus scan)
}
```

All 7 disk touchpoints (upload write; preview/html/classify/extract reads) are refactored to call `objectStore`. The stored object key is persisted in `Document.storedFilename`.

## Consequences
- **Positive**: Files survive redeploys; R2 buckets are independently backup-able and lifecycle-managed.
- **Positive**: Pluggable `onStored` hook enables a ClamAV/anti-malware scan step without touching call sites.
- **Positive**: Signed URLs remove the app server from the document-preview hot path.
- **Negative**: Extra dependency (`@aws-sdk/client-s3`) and a new credential set (`R2_*`).
- **Negative**: Local dev must keep working — hence `LocalStore` default when `STORAGE_DRIVER` is unset.

## Alternatives Considered
- **AWS S3** (viable; R2 chosen for zero egress + S3-compatible, swappable later since the SDK is identical).
- **Abstract only, stay local** (rejected: does not solve durability/redeploy loss).

## Review Date
Q4 2026
