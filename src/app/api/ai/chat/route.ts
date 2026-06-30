import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { logger } from '@/lib/logger'

const SYSTEM_PROMPT = `You are TaxDox AI Assistant, an expert tax document intelligence assistant for accounting firms.

You help tax professionals with:
- Understanding tax document types (W-2, 1099 series, K-1, 1098, etc.)
- PBC (Prepared by Client) document list management
- AI data extraction and field-level confidence
- Tax software integration (UltraTax, CCH, Lacerte, etc.)
- Workflow automation for tax engagements
- Tax preparation best practices
- IRS compliance and deadlines

Keep responses concise, professional, and actionable. Use bullet points when helpful.
If asked about specific tax advice for a client, remind them to consult a licensed CPA.
You are part of the TaxDox AI platform — "Other tools extract data. TaxDox AI understands your tax workflow."`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages } = body

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      stream: false,
    })

    const reply =
      completion?.choices?.[0]?.message?.content ||
      'I apologize, I could not process that request. Please try again.'

    return NextResponse.json({ reply })
  } catch (error) {
    logger.ai.error('AI chat error:', { error: String(error) })
    return NextResponse.json(
      {
        reply:
          "I'm having trouble connecting right now. As a TaxDox AI assistant, I can help you with document classification, PBC list management, extraction confidence, and tax workflow questions. Please try again in a moment.",
      },
      { status: 200 }
    )
  }
}
