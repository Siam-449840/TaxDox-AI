/**
 * TaxDox AI — Inngest client (ADR-004)
 *
 * Serverless-native job queue. The extraction pipeline runs as an Inngest
 * function so long-running AI work doesn't time out the request tier.
 *
 * Selection: when INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY are unset (local
 * dev), `isQueueEnabled()` returns false and the upload route runs extraction
 * synchronously as before — the app never hard-requires the queue.
 */

import { Inngest } from 'inngest'

/**
 * Is the Inngest queue configured? Call sites use this to decide between
 * enqueuing (prod) and running inline (dev fallback).
 */
export function isQueueEnabled(): boolean {
  return !!(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY)
}

// Lazily create the client only when configured, so dev without keys works.
let _client: Inngest | null = null

export function getInngest(): Inngest {
  if (!_client) {
    _client = new Inngest({
      id: 'taxdox-ai',
      eventKey: process.env.INNGEST_EVENT_KEY,
      signingKey: process.env.INNGEST_SIGNING_KEY,
    })
  }
  return _client
}

/** Canonical event names. */
export const EVENTS = {
  extractionRequested: 'extraction/requested',
  outboxDrain: 'outbox/drain',
} as const
