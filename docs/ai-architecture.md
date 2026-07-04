# TaxDox AI — AI Architecture (Multi-Provider Gateway)

## Overview

All AI features (document classification, field extraction, assistant chat) flow
through a single **AI Gateway**. No route, job, or component calls a provider
SDK directly. Providers are pluggable: the active one is selected by
`AI_PROVIDER` (env), and adding a new one does **not** require touching any
application code.

```
Application (routes / Inngest jobs)
        │
        ▼
   AIGateway                         src/lib/ai/gateway.ts
   - provider selection (env)
   - per-provider circuit breaker
   - metrics + structured logging
   - fallback orchestration hooks
        │
        ▼
   AIProvider interface              src/lib/ai/types.ts
   (ZERO provider knowledge)
        │
        ▼
   GeminiProvider                    src/lib/ai/gemini-provider.ts
   (the ONLY file that imports @google/genai)
```

## Modules

| Module | Role |
|---|---|
| `src/lib/ai/types.ts` | `AIProvider` interface, result types, `ProviderError`. No provider imports. |
| `src/lib/ai/registry.ts` | `registerProvider(name, factory)` / `getProvider(name)`. Lazy construction. |
| `src/lib/ai/prompts.ts` | Versioned prompt registry (`gemini-3.5-flash-*-v1` labels). |
| `src/lib/ai/schema-validation.ts` | Strict JSON gate — parse → repair → validate → reject. Never trusts raw output. |
| `src/lib/ai/gemini-provider.ts` | The sole `@google/genai` import. Timeout/retry/safety/error-normalization. |
| `src/lib/ai/gateway.ts` | Application chokepoint. Breaker + metrics + fallback. |
| `src/lib/ai/evaluation.ts` | Provider-agnostic accuracy scoring for the eval framework. |
| `src/lib/ai/index.ts` | Barrel — application code imports only from here. |

## Why this layering

1. **Provider isolation.** Gemini specifics (model name, SDK, error shapes,
   safety settings) live in exactly one file. Swapping providers or running
   multiple side-by-side never leaks into routes.
2. **Testability.** The gateway accepts any `AIProvider`; tests can substitute
   a stub without mocking HTTP.
3. **Observability.** Every call is wrapped with a circuit breaker and logged
   with `{provider, model, latencyMs, fallback, ok}` — uniform across providers.
4. **Cost control.** `providerMeta()` reports cost-per-1k so the gateway can
   attribute spend regardless of provider.

## Reliability layers (unchanged from the prior architecture)

- **Circuit breaker** — one per provider (`ai-<name>`). Trips after 5 failures
  in 60s, half-opens after 60s. Surfaced in `/api/health/ready`.
- **Timeouts** — 30s text / 60s vision.
- **Retries** — 2 attempts, exponential backoff, only on transient/quota/5xx.
- **Schema validation** — every model response is JSON-parsed + field-validated
  before it touches the DB. Malformed output falls back to the filename
  heuristic / simulated path rather than persisting garbage.
- **Prompt-injection defense** — document text is still passed through
  `sanitizeDocumentText()` (`src/lib/ai-security.ts`) at the application
  boundary before reaching any provider.
- **PII masking** — extraction prompts instruct the model to mask SSN/EIN; the
  existing `maskPII` / AES-256-GCM encryption layers are untouched.
- **Version provenance** — every `Extraction` row records `modelVersion`,
  `templateVersion`, `promptVersion`, `isFallback`.

## Fallback readiness

The gateway is built to try providers in a priority order (`AI_PROVIDER` first,
then `AI_FALLBACK_PROVIDERS`). Today only Gemini is registered, so fallback is
dormant — but the shape means adding a secondary provider is config + one
registration call, not a rewrite. Per-provider breakers mean one provider's
outage doesn't block a healthy secondary.

## Adding a provider (e.g. OpenAI)

1. `npm install <provider-sdk>`.
2. Create `src/lib/ai/openai-provider.ts`:
   ```ts
   import type { AIProvider } from './types'
   export class OpenAIProvider implements AIProvider { /* ... */ readonly name = 'openai' /* ... */ }
   ```
3. Register it in `src/lib/ai/gateway.ts`'s `ensureProvidersRegistered()`:
   ```ts
   const { OpenAIProvider } = await import('./openai-provider')
   registerProvider('openai', () => new OpenAIProvider())
   ```
4. Set `AI_PROVIDER=openai` (and any provider-specific env).

No route, job, or component file changes. That's the whole point.

## Configuration

| Env | Required | Purpose |
|---|---|---|
| `AI_PROVIDER` | prod | Selects the active provider (`gemini`). |
| `GEMINI_API_KEY` | prod | Gemini auth. |
| `GEMINI_MODEL` | prod | Model id (`gemini-3.5-flash`). |
| `AI_FALLBACK_PROVIDERS` | optional | Ordered comma-separated fallback chain. |

All three are validated by `validateEnv()` at boot (fail-loud in production).

## Evaluation framework

`eval/golden/` holds labeled fixtures; `scripts/run-eval.ts` runs them through
the gateway and scores field accuracy / hallucination rate / confidence
calibration / classification accuracy. See `eval/golden/README.md`.

This is the regression net for provider or prompt changes: a model swap or
prompt rewrite that drops accuracy shows up in the eval report, not in
production support tickets.
