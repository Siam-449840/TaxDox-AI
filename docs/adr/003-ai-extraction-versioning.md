# ADR-003: AI Extraction with Version Tracking

## Status
Accepted

## Context
The guideline (Section 5) requires AI extraction to be treated as a platform, not a feature. Previous implementation had no version tracking — debugging accuracy regressions was guesswork. Simulated/fallback extractions were indistinguishable from real AI output.

## Decision
1. Every extraction records: `modelVersion`, `templateVersion`, `promptVersion`, `isFallback`
2. Real AI extraction (GLM-4.6V) is distinguishable from simulated/fallback paths
3. Hallucination detection validates extracted values against document text
4. Prompt injection defense sanitizes document text before AI calls
5. Cross-document validation checks consistency across an engagement's documents

## Consequences
- **Positive**: Accuracy regressions can be traced to specific prompt/template/model changes
- **Positive**: Fallback paths are clearly marked, no fake confidence scores
- **Positive**: Hallucinated values are flagged and reduce confidence
- **Negative**: Additional storage per extraction record (minimal)

## Alternatives Considered
- No version tracking (rejected: unverifiable accuracy claims)
- Separate AI service with its own database (Phase 3+)

## Review Date
Q3 2026
