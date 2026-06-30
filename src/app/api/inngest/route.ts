import { inngestServe } from '@/inngest/functions'

/**
 * GET/POST /api/inngest
 *
 * Inngest's webhook + SDK endpoint. Inngest calls this to register functions
 * and to invoke them. Public (no NextAuth) — Inngest authenticates via the
 * signing key, validated inside the SDK.
 */

const handler = inngestServe()

export const { GET, POST, PUT } = handler
