# ADR-001: Modular Monolith Architecture

## Status
Accepted

## Context
The guideline (Section 2) specifies six bounded contexts with domain events. Full microservices are Phase 3+ and premature for Phase 1. We need a structure that allows future service decomposition without requiring it now.

## Decision
Organize the codebase into clear modules with enforced internal/external boundaries (modular monolith), while remaining a single deployable app with one database.

Modules:
- Identity & Access (`src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/encryption.ts`)
- Engagement Management (`src/app/api/engagements/`, `src/app/api/clients/`)
- Document Intelligence (`src/app/api/documents/`, `src/app/api/ai/`)
- Workflow Automation (`src/app/api/engagements/[id]/send/`)
- Tax Jurisdiction (`src/lib/tax-plugins/`)
- Billing & Subscription (`src/app/api/stripe/`, `src/lib/stripe.ts`)

## Consequences
- **Positive**: Future service split is possible without rewrite; stops implicit cross-table coupling
- **Positive**: Easier to reason about and verify than microservices
- **Negative**: Module boundaries are enforced by convention, not compilation
- **Negative**: All modules share one database (acceptable for Phase 1 scale)

## Alternatives Considered
- Full microservices with separate databases per service (Phase 3+)
- Event-sourced architecture with event bus (Phase 3+)

## Review Date
Q3 2026
