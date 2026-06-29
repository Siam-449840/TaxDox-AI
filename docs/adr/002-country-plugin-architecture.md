# ADR-002: Country Plugin Architecture

## Status
Accepted

## Context
The guideline (Section 6) requires multi-country tax support via a plugin ecosystem. Tax law varies structurally across jurisdictions — hardcoded country logic would not scale and would make adding countries a code change.

## Decision
Implement country plugins as pure data (JSON config files) with a standard interface. Adding a country = writing a JSON file, not changing application code.

Structure:
- `src/lib/tax-plugins/types.ts` — Plugin interface
- `src/lib/tax-plugins/us.json`, `gb.json`, `ca.json`, `in.json`, `au.json` — Country configs
- `src/lib/tax-plugins/registry.ts` — Plugin registry and public API

Each config includes: document types, extraction fields, filing deadlines, tax brackets, currency/locale settings, identifier formats, support tier.

## Consequences
- **Positive**: New countries added via config, zero code changes
- **Positive**: Rules can be versioned by tax year (future enhancement)
- **Positive**: Support tiers are explicit and visible to users
- **Negative**: Complex country-specific logic can't always be expressed as pure data

## Alternatives Considered
- Hardcoded country logic in TypeScript functions (rejected: not scalable)
- Dynamic code loading for country modules (rejected: security risk for marketplace)

## Review Date
Q3 2026
