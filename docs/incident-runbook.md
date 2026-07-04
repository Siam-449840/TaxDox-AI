# TaxDox AI — Incident Response Runbook

## Severity Levels

| Level | Description | Response Target | Resolution Target |
|-------|-------------|-----------------|-------------------|
| P0 | Production down, data loss risk | 15 min | 2 hours |
| P1 | Critical feature broken, no workaround | 30 min | 4 hours |
| P2 | Feature degraded, workaround exists | 2 hours | 1 day |
| P3 | Minor bug, cosmetic issue | 1 day | 1 week |

---

## Top 10 Failure Scenarios

### 1. Database Connection Pool Exhaustion
**Symptoms**: API returns 500, logs show "Too many connections"
**Runbook**:
1. Check `/api/health` for database status
2. Check Prisma connection pool settings
3. Restart the app server: `bun run dev` (dev) or Vercel redeploy (prod)
4. If persistent, check for unclosed transactions or N+1 queries
5. Consider increasing connection pool size in production

### 2. AI Provider Timeout / Rate Limit
**Symptoms**: Document extraction stuck in "processing", extraction API returns 429 or 504
**Runbook**:
1. Check AI provider status page (Google Gemini — status.cloud.google.com)
2. Verify API key is valid and quota not exhausted
3. Fallback to simulated extraction if provider is down
4. Queue pending extractions and retry when provider recovers
5. Check `/api/health` for AI service status

### 3. S3 / File Storage Unavailability
**Symptoms**: Document upload fails, preview returns 404
**Runbook**:
1. Check S3 bucket status (AWS console)
2. Verify presigned URL generation is working
3. Check bucket permissions and CORS settings
4. If S3 is down, switch to local storage temporarily
5. Document any uploaded-but-not-stored files for reconciliation

### 4. Stripe Webhook Failures
**Symptoms**: Subscription status not updating, users report access issues
**Runbook**:
1. Check Stripe dashboard → Webhooks for failed deliveries
2. Verify webhook endpoint is reachable: `curl /api/stripe/webhook`
3. Check webhook signature verification is working
4. Manually replay failed events from Stripe dashboard
5. Reconcile DB subscription status with Stripe using `/api/stripe/subscription`

### 5. Session/Authentication Failures
**Symptoms**: Users can't log in, "JWEDecryptionFailed" in logs
**Runbook**:
1. Check `NEXTAUTH_SECRET` is set and stable in `.env`
2. Verify no secret rotation happened without clearing old sessions
3. Check `/api/health` for env var status
4. If secret changed, users need to re-authenticate
5. Run smoke test: `bun run smoke`

### 6. Redis Cache Failure
**Symptoms**: Slow API responses, cache hit rate drops to 0%
**Runbook**:
1. Check Redis connection (Upstash dashboard)
2. Verify Redis URL is correct in env
3. App should degrade gracefully (L1 cache still works)
4. Restart Redis if needed
5. Clear cache keys if data is stale

### 7. Background Queue Backlog
**Symptoms**: Documents stuck in "processing" for >5 minutes
**Runbook**:
1. Check Inngest/Upstash QStash dashboard for queued jobs
2. Verify worker functions are deployed and running
3. Check for failed jobs and retry them
4. If queue is backed up, scale workers temporarily
5. Monitor queue depth metric

### 8. Email Delivery Failures
**Symptoms**: PBC requests not reaching clients, bounce rate high
**Runbook**:
1. Check email provider status (Resend/SendGrid)
2. Verify sender domain is authenticated (SPF, DKIM, DMARC)
3. Check for bounce/complaint notifications
4. Review email logs in `/api/emails` endpoint
5. Switch to backup email provider if primary is down

### 9. High Error Rate (>1% of requests)
**Symptoms**: Sentry/Datadog alerts firing, users reporting errors
**Runbook**:
1. Check error dashboard for error patterns
2. Identify the most common error type
3. Check recent deployments for regressions
4. If deployment-related, rollback to previous version
5. Run smoke test to verify auth still works

### 10. Security Incident (Suspected Breach)
**Symptoms**: Unusual access patterns, unauthorized API calls, data exfiltration signs
**Runbook**:
1. Immediately rotate all secrets (NEXTAUTH_SECRET, Stripe keys, AI keys)
2. Force-logout all users (invalidate sessions)
3. Check audit logs for unauthorized access
4. Review access logs for IP anomalies
5. Notify affected firms within 72 hours (GDPR requirement)
6. Document incident timeline and root cause

---

## Escalation Path

1. **On-call engineer** receives alert (PagerDuty/Better Uptime)
2. Acknowledge alert within response target
3. If not resolved within 50% of resolution target, escalate to **engineering lead**
4. If P0 and not resolved within 1 hour, escalate to **CTO**
5. Post-incident: blameless postmortem within 48 hours

---

## Backup & Restore

### Backup Schedule
- PostgreSQL: Automated daily backups (30-day retention), point-in-time recovery
- S3: Versioning enabled, cross-region replication
- Database schema: Tracked in git via Prisma migrations

### Restore Drill (Monthly)
1. Create a test database from latest backup
2. Run `bun run db:push` against test DB
3. Verify all tables and data are present
4. Run smoke test against restored data
5. Document drill results in `/docs/backup-restore-log.md`
