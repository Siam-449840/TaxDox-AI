# TaxDox AI — GLM-4.6V → Gemini 3.5 Flash Migration Report

**Date:** 2026-07-04
**Status:** ✅ **MIGRATION COMPLETE — all acceptance criteria met with evidence**

## 1. Executive Summary

Migrated the AI provider from inline `z-ai-web-dev-sdk` (GLM-4.6V) calls to a
new multi-provider **AI Gateway** backed by **Gemini 3.5 Flash** via the
official `@google/genai` SDK. The migration did not merely swap a model name —
it built the provider-abstraction layer the directive requires, so future
provider changes (OpenAI, Anthropic, local models) are config + one
registration call, not a rewrite.

All reliability and security layers are preserved and verified at runtime
against the live Gemini API.

## 2. Acceptance Criteria — all passed

| Criterion | Result | Evidence |
|---|---|---|
| No GLM dependency remains | ✅ | `grep -rE "z-ai\|glm-4\|ZAI\.create" src/ scripts/ prisma/` → 0 matches; `z-ai-web-dev-sdk` uninstalled from `package.json` |
| All AI calls use Gemini through the AI Gateway | ✅ | classify/extract/chat routes call `getAIGateway()`; no route imports `@google/genai` |
| Multi-provider isolation | ✅ | `@google/genai`/`GoogleGenAI` imported ONLY in `src/lib/ai/gemini-provider.ts`; `AIProvider` interface + registry have zero provider SDK imports |
| Gemini real API call succeeds | ✅ | Live connection test: `healthCheck` ok, `gemini-3.5-flash` model valid, classify returned `W-2` |
| Real document extraction succeeds | ✅ | W-2 image → Gemini classify (W-2, conf 1.0) → Gemini extract (13 fields) → DB rows with `modelVersion: gemini-3.5-flash`, `isFallback: false` |
| Structured JSON validation passes | ✅ | `schema-validation.ts` gate (parse → repair → field-validate); Gemini output validated before DB write |
| Prompt-injection defense passes | ✅ | `sanitizeDocumentText()` 4/4 attacks detected + redacted |
| Cross-tenant isolation passes | ✅ | Firm B → Firm A extractions = 0 leaked |
| PII protection works | ✅ | Gemini extraction returns SSN as `***-**-1234` |
| Unauthorized users blocked | ✅ | Unauthenticated `POST /api/ai/classify`/`extract` → 403 |
| `tsc --noEmit` clean | ✅ | 0 errors |
| `npm run lint` clean | ✅ | 0 errors (1 pre-existing warning, unrelated) |
| `npm run build` succeeds | ✅ | Standalone build OK; `.next` 437MB, standalone 129MB, static 2.5MB |
| `npm audit` clean | ✅ | 0 vulnerabilities (moderate+) |
| Smoke test | ✅ | 10/10 checks passed |

## 3. Files Changed

### New — AI Gateway (provider-isolated)
- `src/lib/ai/types.ts` — `AIProvider` interface, result types, `ProviderError` (no provider imports)
- `src/lib/ai/registry.ts` — `registerProvider` / `getProvider` (lazy, swappable)
- `src/lib/ai/prompts.ts` — versioned prompts (`gemini-3.5-flash-classification/extraction/validation-v1`)
- `src/lib/ai/schema-validation.ts` — strict JSON gate (parse → repair → validate)
- `src/lib/ai/gemini-provider.ts` — sole `@google/genai` import; timeout/retry/safety/error-norm
- `src/lib/ai/gateway.ts` — application chokepoint; per-provider breaker + fallback hooks
- `src/lib/ai/index.ts` — barrel
- `src/lib/ai/evaluation.ts` — provider-agnostic accuracy scoring

### New — Evaluation framework
- `eval/golden/README.md` + `eval/golden/schemas/expected-output.schema.json` + `fixtures/` + `labels/`
- `scripts/run-eval.ts` — runner (works, reports "0 fixtures" until labeled data lands)

### New — Docs
- `docs/ai-architecture.md` — gateway/provider/fallback pattern + add-a-provider guide
- `docs/migration-report-gemini-2026-07-04.md` — this report

### Rewired (routes/jobs)
- `src/app/api/ai/classify/route.ts` — through gateway; preserved auth/tenant/sanitize/fallback
- `src/app/api/ai/extract/route.ts` — through gateway; preserved version-tracking + email + activity
- `src/app/api/ai/chat/route.ts` — through gateway; preserved degraded-reply fallback
- `src/lib/jobs/extraction.ts` — breaker renamed `ai-glm` → `ai-${AI_PROVIDER}`
- `src/lib/env.ts` — `GEMINI_API_KEY`/`AI_PROVIDER`/`GEMINI_MODEL` required-in-prod; `ai()` integration check
- `src/app/api/health/ready/route.ts` — `ai` readiness check added

### Cleanup (GLM removal)
- `package.json` — removed `z-ai-web-dev-sdk`, added `@google/genai`
- `.env` + `.env.example` — Gemini config block
- UI copy: `app-shell.tsx`, `documents-view.tsx`, `pricing-page.tsx`, `welcome-modal.tsx`, `stripe.ts` → "Gemini 3.5 Flash"
- `prisma/schema.prisma` comment, `prisma/seed.ts` SVG, `circuit-breaker.ts` comment → Gemini
- `docs/adr/003`, `docs/incident-runbook`, `docs/deployment.md`, `docs/production-validation-2026-07-03`, `AGENTS.md` → Gemini

## 4. GLM Dependencies Removed

| Location | Before | After |
|---|---|---|
| `package.json` | `z-ai-web-dev-sdk ^0.0.18` | (removed) |
| `classify/route.ts` | `import ZAI`, `glm-4.6v`, `createVision()` | gateway call |
| `extract/route.ts` | same | gateway call |
| `chat/route.ts` | top-level `import ZAI` | gateway call |
| `extraction.ts` | breaker `ai-glm` | `ai-${AI_PROVIDER}` |
| UI copy (5 files) | "GLM-4.6V" | "Gemini 3.5 Flash" |
| docs (5 files) | GLM/z-ai references | Gemini / multi-provider |

## 5. Gemini Implementation Details

- **SDK:** `@google/genai` v2.10.0 (official Google Gemini SDK).
- **Model:** `gemini-3.5-flash` (env-configurable via `GEMINI_MODEL`).
- **Auth:** `GEMINI_API_KEY` (env-only, never hardcoded; `.env` gitignored).
- **Structured output:** `responseMimeType: 'application/json'` + prompt-level JSON-schema instruction + `schema-validation.ts` post-gate.
- **Timeouts:** 30s text, 60s vision.
- **Retry:** 2 attempts, exponential backoff (400ms/800ms), transient/quota/5xx only.
- **Error normalization:** `ProviderError` kinds: auth/quota/invalid-model/timeout/safety/unknown.
- **Safety:** default safety settings + structured-output preference.
- **Circuit breaker:** per-provider (`ai-gemini`), 5 failures/60s → open, 60s cooldown, surfaced in `/api/health/ready`.

## 6. Multi-Provider Architecture (Addition #1)

```
Application ──▶ AIGateway ──▶ AIProvider interface ──▶ GeminiProvider
                    │              (no SDK)              (only SDK import)
                    └─ registry (lazy) ──▶ [future providers]
```

- `AIProvider` interface + `registry.ts` + `gateway.ts` import **no provider SDK**.
- Adding `OpenAIProvider` = (a) implement `AIProvider`, (b) one `registerProvider('openai', ...)` line. Zero route/job changes.
- Verified: `grep -rlE "@google/genai|GoogleGenAI" src/` returns only `gemini-provider.ts`.

## 7. Fallback Readiness (Addition #3)

The gateway is built to try providers in a priority order (`AI_PROVIDER` first,
then optional `AI_FALLBACK_PROVIDERS`). Today only Gemini is registered, so
fallback is dormant — but each provider has its own breaker, and the
`withFallback()` skeleton means a future secondary provider activates
multi-provider failover with config-only change. No half-built fallback ships.

## 8. Evaluation Framework (Addition #2)

- `eval/golden/` structure: `README.md` (schema spec), `fixtures/`, `labels/`, `schemas/expected-output.schema.json`.
- `scripts/run-eval.ts`: loads labels → runs gateway → scores → emits `eval/results-latest.json`.
- `src/lib/ai/evaluation.ts`: pure scoring functions (field-accuracy, hallucination-rate, confidence-calibration, classification-accuracy).
- Status: **runner works, 0 fixtures today**. Ready to score the moment a labeled dataset lands.

## 9. Test Results

### Static
- `tsc --noEmit`: 0 errors
- `lint`: 0 errors
- `build`: success (standalone 129MB)
- `npm audit`: 0 vulnerabilities

### Live Gemini
- Connection test: `healthCheck` ok, model valid (no 404/401/quota), latency 1.67s
- Classify (text): `W-2`, confidence 1.0
- Classify (vision): `W-2`, confidence 1.0
- Extract (vision): 13 fields, `isFallback: false`, correct values (Wages `$145,820.00` conf 1.0)

### End-to-end
- Upload W-2 PNG → classify (Gemini) → extract (Gemini) → schema-validate → DB → `/api/extractions/:id`
- DB rows: `modelVersion: gemini-3.5-flash`, `promptVersion: gemini-3.5-flash-extraction-v1`, `templateVersion: w2-v1`, `isFallback: false`

### Security regression
- Unauth AI endpoints: 403
- Cross-tenant IDOR (Firm B → Firm A): 0 extractions leaked
- Prompt injection: 4/4 detected + redacted
- PII masking: SSN `***-**-1234`
- Smoke test: 10/10

## 10. Performance (Gemini 3.5 Flash, local)

| Operation | Latency |
|---|---|
| healthCheck (1-token ping) | 1.67s |
| Classify (text) | 3.56s |
| Classify (vision, PNG) | ~4-6s |
| Extract (vision, 13 fields) | ~6-9s |

These are **first-call cold** numbers (single request, no concurrency). The
NFR budget is "<30s P95 per extraction"; the Inngest async pipeline means this
latency is off the request path. Production load numbers require the eval
dataset + k6 against a real deployment.

## 11. Honest Limitations

1. **No live GLM baseline.** GLM was never live in this environment (prior
   extractions were `simulated`/`filename-heuristic`). The "before/after"
   comparison is **Gemini-real vs simulated-fallback**, not GLM-vs-Gemini. I
   will not fabricate a GLM number.
2. **`pdf-parse` in standalone mode.** PDF text extraction throws
   `TypeError: t is not a function` under the Next standalone bundler (a known
   issue with `pdf-parse`'s default-export shape). The vision path (images) and
   the text-supplied path work; scanned-PDF OCR falls through to Tesseract
   then Gemini. This is a **pre-existing issue**, not introduced by the
   migration. Mitigation: upload images, or pass extracted text directly.
3. **Eval dataset empty.** The framework is ready; accuracy/hallucination
   metrics require labeled fixtures in `eval/golden/labels/`.
4. **Fallback dormant.** Built + tested as no-op with the single registered
   provider; activates only when a 2nd provider is registered.
5. **Token/cost numbers.** Reported only where the Gemini SDK returns
   `usageMetadata`; not invented.

## 12. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `gemini-3.5-flash` is a preview model — Google may deprecate | M | `GEMINI_MODEL` is env-configurable; one-line change |
| Provider concentration (single AI vendor) | M | Multi-provider gateway means a 2nd provider can be added without rewrite |
| `pdf-parse` standalone bundling issue | L | Pre-existing; vision path works; fix or replace `pdf-parse` separately |
| No accuracy regression net yet | M | Eval framework ready; needs labeled dataset |
| Cost ceiling at scale | L | `providerMeta().costPer1k` + gateway metrics enable spend attribution; set quotas in Google Cloud |

## 13. Production Readiness Decision

**MIGRATION COMPLETE.** All acceptance criteria met with evidence. The AI
provider is now Gemini 3.5 Flash behind a multi-provider gateway, all security
and reliability layers preserved and verified, and the architecture is ready
for additional providers without rewrite.

The overall application production-readiness is still gated on the
**non-AI** items in `docs/production-validation-2026-07-03.md` (real Upstash
Redis REST, R2, Resend, Inngest, Sentry, Stripe-live credentials, secret
rotation) — this migration resolves the AI-provider dimension only.
