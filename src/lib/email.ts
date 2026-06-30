/**
 * TaxDox AI — Email Transport (ADR: real delivery via Resend)
 *
 * All "email sends" used to be silent DB inserts. This module provides a real
 * transport interface:
 *   - ResendTransport: production delivery via Resend (EMAIL_DRIVER=resend).
 *   - LogTransport:    dev fallback that only writes the EmailLog row (the
 *                      legacy behavior), so bun dev works without keys.
 *
 * `sendEmail()` is the single orchestrator every call site uses. It:
 *   1. Delivers via the active transport (when enabled).
 *   2. Writes an EmailLog row whose status reflects the REAL transport result
 *      ('sent' | 'failed') instead of an unconditional 'sent'.
 *
 * The transactional outbox (ADR-007) wraps this: mutations emit an outbox
 * event in the same transaction, and a relay drains it calling sendEmail().
 * Until the relay is wired (Phase 4), sendEmail() runs synchronously.
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface EmailMessage {
  to: string
  toName?: string
  subject: string
  html: string
  /** Plain-text body (optional; Resend auto-generates from html if omitted). */
  text?: string
}

export interface EmailSendResult {
  status: 'sent' | 'failed'
  /** Provider message id when delivered. */
  messageId?: string
  /** Error description on failure. */
  error?: string
}

export interface EmailTransport {
  send(msg: EmailMessage): Promise<EmailSendResult>
}

// ─── ResendTransport ───────────────────────────────────────────────

class ResendTransport implements EmailTransport {
  private from: string

  constructor() {
    const from = process.env.FROM_EMAIL
    if (!from) {
      throw new Error('FROM_EMAIL must be set when EMAIL_DRIVER=resend')
    }
    this.from = from
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    // Lazy import so the SDK isn't required in dev (LogTransport path).
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY!)

    const { data, error } = await resend.emails.send({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })

    if (error) {
      return { status: 'failed', error: error.message }
    }
    return { status: 'sent', messageId: data?.id }
  }
}

// ─── LogTransport (dev fallback) ───────────────────────────────────

class LogTransport implements EmailTransport {
  async send(): Promise<EmailSendResult> {
    // No real delivery in dev — the EmailLog row written by sendEmail() is
    // the visible record. Mark as 'sent' so dev flows that check status pass.
    return { status: 'sent', messageId: `dev-${Date.now()}` }
  }
}

// ─── Factory ───────────────────────────────────────────────────────

let _transport: EmailTransport | null = null

export function getEmailTransport(): EmailTransport {
  if (_transport) return _transport

  const driver = process.env.EMAIL_DRIVER
  if (driver === 'resend' && process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
    logger.notification.info('Email transport: Resend')
    _transport = new ResendTransport()
  } else {
    if (process.env.NODE_ENV === 'production' && driver === 'resend') {
      logger.notification.warn(
        'Resend selected but RESEND_API_KEY/FROM_EMAIL unset — falling back to log-only. No real mail will be delivered in production.'
      )
    } else {
      logger.notification.info('Email transport: log-only (development)')
    }
    _transport = new LogTransport()
  }
  return _transport
}

export function isRealEmailConfigured(): boolean {
  return (
    process.env.EMAIL_DRIVER === 'resend' &&
    !!process.env.RESEND_API_KEY &&
    !!process.env.FROM_EMAIL
  )
}

// ─── Orchestrator ──────────────────────────────────────────────────

export interface SendEmailParams extends EmailMessage {
  firmId: string
  engagementId?: string | null
  clientId?: string | null
  template: string
  fromName?: string
}

/**
 * Deliver an email and persist the result. This replaces the old "fire and
 * write an unconditional 'sent' row" pattern — the EmailLog.status now
 * reflects the real transport outcome, making delivery observable.
 *
 * Failures do NOT throw (best-effort); the failed status is recorded for
 * retry by the outbox relay.
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  const transport = getEmailTransport()

  let result: EmailSendResult
  try {
    result = await transport.send({
      to: params.to,
      toName: params.toName,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
  } catch (err) {
    result = { status: 'failed', error: err instanceof Error ? err.message : String(err) }
  }

  // Persist the EmailLog with the real result.
  try {
    await db.emailLog.create({
      data: {
        firmId: params.firmId,
        engagementId: params.engagementId ?? null,
        clientId: params.clientId ?? null,
        toEmail: params.to,
        toName: params.toName ?? '',
        fromName: params.fromName ?? 'TaxDox AI',
        subject: params.subject,
        body: params.html,
        template: params.template,
        status: result.status,
        sentAt: new Date(),
      },
    })
  } catch (logErr) {
    // Even if the log write fails, surface the transport result so the caller
    // can decide. Never throw out of sendEmail.
    logger.notification.error('EmailLog write failed', { error: String(logErr) })
  }

  if (result.status === 'failed') {
    logger.notification.warn('Email delivery failed', {
      to: params.to,
      template: params.template,
      error: result.error,
    })
  } else {
    logger.notification.info('Email delivered', {
      to: params.to,
      template: params.template,
      messageId: result.messageId,
    })
  }

  return result
}
