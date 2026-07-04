# TaxDox AI — Golden Evaluation Dataset

Labeled fixtures used by `scripts/run-eval.ts` to score AI extraction quality
(field accuracy, hallucination rate, confidence calibration, classification
accuracy). The runner is provider-agnostic — it grades whichever provider the
gateway selects.

## Layout

```
eval/golden/
├── README.md                          ← this file
├── fixtures/                          ← source documents (PDF/image/etc.)
│   └── .gitkeep
├── fixtures.w2/                       ← grouped by doc type (optional)
├── labels/                            ← one JSON per fixture (the "answers")
│   └── w2-001.json
└── schemas/
    └── expected-output.schema.json    ← the JSON schema for a label
```

## Adding a fixture

1. Drop the source document into `fixtures/` (e.g. `w2-001.pdf`).
2. Create a matching label in `labels/w2-001.json`:

```json
{
  "id": "w2-001",
  "file": "fixtures/w2-001.pdf",
  "documentType": "W-2",
  "expectedFields": [
    { "name": "employer_name", "value": "Acme Corp" },
    { "name": "box1_wages", "value": "$145,820.00", "tolerance": 0.01 },
    { "name": "employee_ssn", "value": "***-**-1234" }
  ],
  "mustDetect": ["employer_ein", "box2_federal_tax"]
}
```

3. Field `name`s MUST match the `DocTypeDef.fields[].name` for the document
   type in `src/lib/constants.ts` — otherwise the scorer can't grade them.
4. `tolerance` (optional) allows numeric/currency wiggle. SSN/EIN may be
   partial-matched on last-4 by the scorer.

## Running

```bash
bun scripts/run-eval.ts
# → eval/results-latest.json
```

With zero fixtures the runner reports "0 fixtures" and exits 0 — it's ready to
grade the moment real labeled data lands here.

## Why this matters

This dataset is the only way to detect silent accuracy regressions when a
provider changes models, prompts are updated, or a second provider is added.
Without it, "did extraction quality go up or down?" is unanswerable.
