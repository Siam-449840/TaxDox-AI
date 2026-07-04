import { GeminiProvider } from '../src/lib/ai/gemini-provider'

async function main() {
  const p = new GeminiProvider()
  console.log('provider meta:', p.providerMeta())
  console.log('--- health check ---')
  const h = await p.healthCheck()
  console.log(h)
  if (!h.ok) { console.error('FAIL: not healthy'); process.exit(1) }
  console.log('--- minimal classify (text) ---')
  const c = await p.classifyDocument({ text: 'WAGE AND TAX STATEMENT 2025. Wages $50,000. Federal tax $5,000. Employer EIN 12-3456789.', filename: 'w2.pdf' })
  console.log(c)
  console.log('PASS: Gemini reachable, model valid, classify works')
}
main().catch(e => { console.error('ERROR', e); process.exit(1) })
