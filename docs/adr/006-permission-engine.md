# ADR-006: Permission Engine (role-based now, ABAC-shaped)

## Status
Accepted

## Context
Authorization is currently **absent server-side**: middleware checks only token presence, and routes trust `firmId` from the request body. Any authenticated user (e.g. a `preparer`) can hit admin endpoints (`POST /api/settings/team`, `POST /api/emails`) and — because GETs aren't firm-scoped — read other tenants' data. This is a critical multi-tenancy and privilege-escalation hole for a platform holding tax PII.

## Decision
Introduce a **`PermissionEngine`** (`src/lib/permissions.ts`) with a single entry point:

```ts
can(user, action, resource, ctx): boolean
requirePermission(req, action, resource): Promise<{ user, firmId } | NextResponse(403)>
```

Today it enforces a **role matrix** (admin/partner = all; manager = engagements/clients/documents/emails; preparer = documents/extractions/pbc; read-only = GET only), **always sourced from the session** (never the request body).

It is deliberately **ABAC-shaped**: the `ctx` carries attributes (ownership, subscription tier, country) so attribute-based rules (firm type, department, plan-gated features) can be added later without changing call sites. `firmId` is always taken from `session.user.firmId`, closing the tenant-isolation hole.

## Consequences
- **Positive**: One authorization chokepoint; impossible to "forget" a role check if routes use `requirePermission`.
- **Positive**: Tenant isolation becomes a property of the helper, not a per-route convention.
- **Positive**: Forward-compatible with ABAC (ownership/plan/country) without a rewrite.
- **Negative**: Every mutation route must opt into the helper (explicit wiring per route).
- **Negative**: Slightly more ceremony than inline checks — acceptable for PII workloads.

## Alternatives Considered
- **Middleware-only RBAC** (rejected: can't express resource/ownership granularity; coarse).
- **Full ABAC rules engine (OPA/Cedar)** now (rejected: over-engineering until attribute rules actually exist; roadmap).

## Review Date
Q4 2026
