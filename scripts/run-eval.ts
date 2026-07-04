/**
 * TaxDox AI — Evaluation Runner (Addition #2)
 *
 * Loads golden fixtures from eval/golden/labels/, runs each through the AI
 * gateway (classify + extract), scores against the expected output, and writes
 * a results JSON. Provider-agnostic — grades whatever provider is active.
 *
 * Run: bun scripts/run-eval.ts
 *
 * With zero fixtures: reports "0 fixtures", exits 0. The runner is ready the
 * moment labeled data lands in eval/golden/.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { getAIGateway } from '../src/lib/ai'
import { DOCUMENT_TYPE_MAP } from '../src/lib/constants'
import {
  evaluateExtraction,
  summarizeMetrics,
  type GoldenFixture,
} from '../src/lib/ai/evaluation'

const GOLDEN_DIR = path.join(process.cwd(), 'eval', 'golden')
const LABELS_DIR = path.join(GOLDEN_DIR, 'labels')
const FIXTURES_DIR = path.join(GOLDEN_DIR, 'fixtures')
const OUT = path.join(process.cwd(), 'eval', 'results-latest.json')

async function loadFixtures(): Promise<GoldenFixture[]> {
  try {
    const files = (await readdir(LABELS_DIR)).filter((f) => f.endsWith('.json'))
    const out: GoldenFixture[] = []
    for (const f of files) {
      const raw = await readFile(path.join(LABELS_DIR, f), 'utf-8')
      out.push(JSON.parse(raw) as GoldenFixture)
    }
    return out
  } catch {
    return [] // labels dir missing/empty
  }
}

async function readFixtureBytes(rel: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const abs = path.join(GOLDEN_DIR, rel)
    const buf = await readFile(abs)
    const ext = path.extname(rel).toLowerCase()
    const MIME_MAP: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
    }
    const mime = MIME_MAP[ext] || 'application/octet-stream'
    return { base64: buf.toString('base64'), mime }
  } catch {
    return null
  }
}

async function main() {
  console.log('=== TaxDox AI — Evaluation Runner ===\n')
  const fixtures = await loadFixtures()
  if (fixtures.length === 0) {
    console.log('0 fixtures found in eval/golden/labels/. Runner is ready — add labeled fixtures to score.')
    console.log('See eval/golden/README.md for the label schema.')
    await mkdir(path.dirname(OUT), { recursive: true }).catch(() => {})
    await writeFile(OUT, JSON.stringify({
      timestamp: new Date().toISOString(),
      fixtureCount: 0,
      status: 'no-fixtures',
      summary: { meanFieldAccuracy: 0, meanHallucinationRate: 0, meanConfidenceCalibration: 0, classificationAccuracy: 0 },
      perFixture: [],
    }, null, 2))
    console.log('wrote:', OUT)
    return
  }

  const gw = getAIGateway()
  const meta = await gw.providerMeta()
  console.log(`provider: ${meta.provider} | model: ${meta.model}`)
  console.log(`fixtures: ${fixtures.length}\n`)

  const perFixture: Array<{ id: string; metrics: ReturnType<typeof evaluateExtraction>; error?: string }> = []

  for (const fx of fixtures) {
    const typeDef = fx.documentType ? DOCUMENT_TYPE_MAP[fx.documentType] : null
    if (!typeDef) {
      console.log(`  ✗ ${fx.id}: unknown documentType "${fx.documentType}"`)
      perFixture.push({ id: fx.id, metrics: zeroMetrics(), error: 'unknown documentType' })
      continue
    }

    const file = await readFixtureBytes(fx.file)
    try {
      const classifyResult = await gw.classify({
        imageBase64: file?.base64,
        mimeType: file?.mime,
      })
      const extractResult = await gw.extract({
        documentType: typeDef.type,
        fields: typeDef.fields.map((f) => ({ name: f.name, label: f.label })),
        imageBase64: file?.base64,
        mimeType: file?.mime,
      })
      const metrics = evaluateExtraction(extractResult, fx, classifyResult)
      perFixture.push({ id: fx.id, metrics })
      console.log(
        `  ${metrics.fieldAccuracy >= 0.8 ? '✓' : '~'} ${fx.id}: ` +
        `field-acc ${(metrics.fieldAccuracy * 100).toFixed(0)}% | ` +
        `halluc ${(metrics.hallucinationRate * 100).toFixed(0)}% | ` +
        `class ${metrics.classificationAccuracy ? 'ok' : 'WRONG'}`
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ✗ ${fx.id}: ${msg}`)
      perFixture.push({ id: fx.id, metrics: zeroMetrics(), error: msg })
    }
  }

  const metricsArr = perFixture.map((p) => p.metrics)
  const summary = summarizeMetrics(metricsArr)
  console.log('\n=== Summary ===')
  console.log(`  mean field accuracy:     ${(summary.meanFieldAccuracy * 100).toFixed(1)}%`)
  console.log(`  mean hallucination rate: ${(summary.meanHallucinationRate * 100).toFixed(1)}%`)
  console.log(`  mean confidence calibr:  ${summary.meanConfidenceCalibration.toFixed(3)}`)
  console.log(`  classification accuracy: ${(summary.classificationAccuracy * 100).toFixed(1)}%`)

  await writeFile(OUT, JSON.stringify({
    timestamp: new Date().toISOString(),
    provider: meta.provider,
    model: meta.model,
    promptVersions: meta.promptVersions,
    fixtureCount: fixtures.length,
    summary,
    perFixture,
  }, null, 2))
  console.log('\nwrote:', OUT)
}

function zeroMetrics() {
  return {
    fieldAccuracy: 0, hallucinationRate: 0, confidenceCalibration: 0,
    classificationAccuracy: 0, fieldsEvaluated: 0, fieldsCorrect: 0, fieldsHallucinated: 0,
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
