import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getAIGateway } from '@/lib/ai'
import { CHAT_SYSTEM_PROMPT } from '@/lib/ai/prompts'

/**
 * AI Assistant chat. Routes through the AI Gateway (active provider today:
 * Gemini 3.5 Flash). Preserves the graceful degraded-reply fallback on failure
 * so a provider outage never breaks the assistant UI.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages } = body

    const gw = getAIGateway()
    const reply = await gw.chat([
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...messages.map((m: { role: 'user' | 'assistant'; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ])

    return NextResponse.json({ reply: reply.reply || 'I apologize, I could not process that request. Please try again.' })
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
