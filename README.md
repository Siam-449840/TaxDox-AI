# TaxDox AI

[![Next.js](https://img.shields.io/badge/Next.js-15%20(App%20Router)-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%20v4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-ORM%206-2d3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%2B-dc382d?style=flat&logo=redis)](https://redis.io/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash-4285F4?style=flat&logo=google-gemini)](https://deepmind.google/technologies/gemini/)
[![Inngest](https://img.shields.io/badge/Inngest-Background%20Jobs-000000?style=flat)](https://www.inngest.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Billing-008cdd?style=flat&logo=stripe)](https://stripe.com/)

An AI-native, multi-tenant tax document intelligence platform designed specifically for accounting and CPA firms. TaxDox AI automates the intake, classification, and field extraction of client tax documents (e.g., W-2s, 1099s, K-1s) using a robust AI Gateway powered by Google Gemini 1.5/2.5 Flash, backed by enterprise-grade tenant isolation, data-at-rest encryption, and a transactional outbox workflow.

---

## 1. Overview

TaxDox AI addresses the annual bottleneck faced by tax preparers: collecting, organizing, and manually typing details from hundreds of tax documents. The platform provides a secure portal where clients can upload files, and CPA firms can manage "Prepared by Client" (PBC) lists, review auto-extracted tax fields, track workflow statuses, and verify extraction provenance.

Designed with **security and multi-tenancy as first-class constraints**, the application enforces cryptographic isolation and tenant boundaries at the database, session, and API route layers to protect sensitive Personally Identifiable Information (PII) like SSNs, EINs, and financial data.

---

## 2. Key Features

### 🧠 AI Intelligence & Gateway
* **Multi-Provider AI Gateway**: A provider-agnostic proxy (`AIGateway`) routes requests with circuit breakers (`ai-<provider>`), structured logging, and fallback mechanisms.
* **Intelligent Document Classification**: Auto-detects tax document types (e.g., `W-2`, `1099-INT`, `1099-DIV`, `1099-B`, `K-1`) based on layout and text.
* **Structural Field Extraction**: Extracts key-value pairs (e.g., wages, federal withholding, SSNs) and assigns confidence ratings per field.
* **Strict Schema Verification**: Validates model output using a repair-and-parse system (`schema-validation.ts`) to ensure conformity with expected formats before database insertion.
* **AI Evaluation Framework**: A golden dataset regression net (`scripts/run-eval.ts`) to grade model accuracy, calibration, and hallucination rates.

### 📄 Intelligent Document Processing
* **Multi-Format Parsing**: Extracts text from PDF, DOCX (Word), XLSX/CSV (Spreadsheets), and image files.
* **Fallback OCR**: Automatically falls back to OCR via Tesseract.js for scanned PDFs and image files.
* **HTML Word Previewing**: Sanitizes and renders DOCX layouts securely in the browser for verification.

### 🔒 Enterprise-Grade Security
* **Tenant Isolation**: Direct database scoping by `firmId` sourced exclusively from the session context (zero reliance on request body properties).
* **Cryptographic Data Protection**: AES-256-GCM field-level encryption for SSNs, EINs, and tax IDs before they are stored in PostgreSQL.
* **Prompt Injection Defense**: Document text is automatically sanitized at the boundary to neutralize adversarial prompt injections.
* **Rate Limiting & Safety**: Session-token rate-limiting backed by Upstash Redis REST.
* **Multi-Factor Authentication (MFA)**: Built-in support for TOTP-based 2FA.

### 💼 Tax Workflow Management
* **Dynamic PBC Lists**: Organizes document requests into category groups (e.g., income, deductions) and monitors client upload progress.
* **Audit Logging**: Structured log database records all data read/write actions, resource modifications, and IP addresses.
* **Transactional Outbox**: Implements the Outbox pattern to guarantee transactional reliability for outbound emails and background queue tasks.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Next.js 15 (App Router), Tailwind CSS v4, Lucide React, Radix UI (via shadcn/ui) |
| **Backend** | Next.js API Routes, NextAuth.js (Session Management) |
| **Database & ORM** | PostgreSQL 15, Prisma ORM 6, pgvector (Vector Embeddings), pg_trgm (Trigram Search) |
| **AI Processing** | Google GenAI SDK (`@google/genai`), Tesseract.js (OCR), pdf-parse, mammoth (Word DOCX), xlsx/papaparse |
| **Infrastructure** | Upstash Redis REST (Rate-Limiting), Cloudflare R2 (S3 Storage), Inngest (Job Queue), Resend (Transactional Email) |
| **Testing & CI** | ESLint, TypeScript Compiler (`tsc`), Playwright/Custom Smoke Runner, k6 (Load Testing) |

---

## 4. Architecture Overview

### High-Level Component Flow

```mermaid
graph TD
    Client[Browser / Client Portal]
    App[Next.js API & App Router]
    Perm[Permission Engine & Session Context]
    Store[Cloudflare R2 Object Store]
    Queue[Inngest Background Queue]
    GW[AI Gateway & Circuit Breakers]
    Gemini[Google Gemini API]
    Outbox[Transactional Outbox Runner]
    DB[(PostgreSQL Database)]

    Client -->|Upload File / API request| App
    App -->|Authorize Request| Perm
    App -->|Store File Buffer| Store
    App -->|Write Record & Outbox Event| DB
    Queue -->|Process Outbox Job| Outbox
    Outbox -->|Request AI Extraction| GW
    GW -->|Send Document Payload| Gemini
    GW -->|Save Extraction Outputs| DB
```

---

## 5. Directory Structure

```
├── .github/workflows/       # GitHub Actions CI/CD pipelines (CI, Security Scan)
├── docs/                    # Architecture Decision Records (ADRs) & Threat Models
│   └── adr/                 # Architecture Decision Records (001 to 009)
├── eval/                    # AI Golden evaluation dataset labels & schemas
├── load-tests/              # k6 performance and DB stress test scripts
├── prisma/                  # Prisma Database Schema and Seed Data
├── scripts/                 # Seeding, HTTP benchmarks, and evaluation runner scripts
├── src/
│   ├── app/                 # Next.js App Router Pages and API endpoints
│   │   ├── api/             # API Router endpoints (firm-isolated)
│   │   └── auth/            # NextAuth credentials sign-in, MFA, and signup portals
│   ├── components/          # Reusable UI component modules (layout, dashboards, PBCs)
│   ├── hooks/               # Custom React hooks
│   ├── inngest/             # Inngest Background Function Handlers
│   ├── lib/                 # Core domain service layer
│   │   ├── ai/              # AI Gateway, Providers, Evaluators, and Prompts
│   │   ├── tax-plugins/     # Extensible country-specific tax rules engine
│   │   ├── circuit-breaker.ts # Multi-state software circuit breakers
│   │   ├── encryption.ts    # AES-256-GCM field-level encryption module
│   │   ├── outbox.ts        # Transactional outbox event writer
│   │   ├── permissions.ts   # requirePermission authorization middleware
│   │   └── rate-limit.ts    # Upstash Redis token bucket rate limiter
│   ├── middleware.ts        # Next.js session validation and route guards
│   └── types/               # Core TypeScript definitions
```

---

## 6. Core Workflows

### Document Upload & AI Processing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant API as Upload Route
    participant R2 as Object Store (R2)
    participant DB as PostgreSQL
    participant Inngest as Inngest Queue
    participant GW as AI Gateway
    participant Gemini as Gemini API

    Client->>API: POST /api/documents/upload (Multipart)
    API->>API: Verify session & check file type
    API->>R2: Stream file buffer to bucket
    R2-->>API: Return unique storedFilename
    API->>DB: Write Document record & OutboxEvent (within single transaction)
    API-->>Client: 200 OK (Status: uploaded)
    
    Note over Inngest, DB: Background Worker polls pending OutboxEvents
    Inngest->>DB: Read & lock pending Event
    Inngest->>GW: Dispatch extract-document payload
    GW->>R2: Retrieve document content
    GW->>Gemini: Classify & Extract fields (image or text)
    Gemini-->>GW: Return JSON Response
    GW->>GW: Run repair & schema-validation rules
    GW->>DB: Save Extractions (linked to Document)
    GW->>DB: Update Document status to 'processed'
```

---

## 7. Security Architecture

### Cryptographic Isolation & Access Control
1. **Authorization Middleware (`requirePermission`)**:
   Every mutating API route passes through `requirePermission(req, action, resource)`. This checks the user's role against the target permission matrix and returns `firmId` extracted directly from the session cookie.
2. **Tenant Scoping Protocol**:
   All DB queries filter strictly by `firmId` or through relations starting from the verified session firm context:
   ```typescript
   // Example of secure query layout
   const documents = await db.document.findMany({
     where: {
       client: { firmId } // Nested relation check — ignores user-provided firmId bodies
     }
   });
   ```
3. **Data-at-Rest Encryption (AES-256-GCM)**:
   Sensitive fields (such as client SSNs and EINs) are encrypted before insertion using the `encryptPII` utility in `src/lib/encryption.ts`, combining a high-entropy key with unique IVs.

---

## 8. AI Gateway & Validation System

The AI layer implements a clean boundary separating model details from application logic.

* ** plupluggable Provider Interface**: The `AIProvider` interface enforces methods for `classifyDocument`, `extractFields`, and `providerMeta`.
* **Resilient Failovers**: If the configured model fails, the gateway catches the exception, logs it, and falls back to a simulated extraction framework or filename heuristics, saving the status with `isFallback: true` to prevent workflow disruption.
* **Safety & Prompt Injection Shield**: Incoming document text is evaluated against a vector of prompt-injection signatures in `src/lib/ai-security.ts`. Matches are immediately neutralized.

---

## 9. Environment Variables Setup

Create a `.env` file in the root directory. You can copy the structure from `.env.example`.

```ini
# Database Connection
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/taxdox?schema=public"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-nextauth-secret-string"

# AI Provider Configuration
AI_PROVIDER="gemini"
GEMINI_API_KEY="your-google-gemini-api-key"
GEMINI_MODEL="gemini-1.5-flash"

# Object Storage (R2 / S3)
STORAGE_DRIVER="local" # Use 'r2' for production
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="taxdox-documents"

# Email Integration (Resend)
EMAIL_DRIVER="local" # Use 'resend' for production
RESEND_API_KEY="your-resend-api-key"

# Inngest Background Jobs
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"

# Redis (Rate Limiting & Session States)
UPSTASH_REDIS_REST_URL="your-upstash-redis-rest-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-rest-token"

# Encryption Key (Must be 32 bytes)
ENCRYPTION_KEY="your-32-character-encryption-key"
```

---

## 10. Getting Started

### Prerequisites
* **Runtime**: [Bun](https://bun.sh/) (preferred) or Node.js v20+
* **Container engine**: Docker & Docker Compose (for Postgres and Redis local environments)

### 1. Spin Up Local Infrastructure
```bash
docker-compose up -d
```
This boots Postgres 15 with vector extensions and a Redis cache container.

### 2. Install Project Dependencies
```bash
bun install
# or: npm install
```

### 3. Setup Database Schema and Migrations
Generate the Prisma Client and apply migrations to the Postgres database:
```bash
npx prisma generate
npm run db:migrate
```

### 4. Seed the Database
Seed Firm A (Meridian CPA Group) and Firm B (Atlas Tax Partners) to verify tenant isolation:
```bash
npm run db:seed
bun scripts/seed-tenant-b.ts
```

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 11. Testing & Validation

### Linting and Type Verification
```bash
# Run ESLint validation
npm run lint

# Run TypeScript typechecks
npx tsc --noEmit
```

### Local Smoke Tests
Run the automated end-to-end smoke test suite to check authentication, session logic, and route security:
```bash
npm run smoke
```

### Performance & Load Benchmarks
Verify API response budgets locally:
```bash
# HTTP performance checks
bun scripts/perf-http.ts

# Run database read load testing with k6 (requires k6 CLI installed)
k6 run load-tests/k6-db-read.js
```

### AI Accuracy Evaluation Runner
Score the active model against Golden fixtures in `eval/golden/`:
```bash
bun scripts/run-eval.ts
```

---

## 12. Deployment Guide

When packaging for production deployment:

1. **Build Step**:
   Compile the Next.js application into a standalone server:
   ```bash
   npm run build
   ```
   This generates `.next/standalone/server.js` with all production assets optimized.
2. **Database Migrations**:
   Run database schema updates in your CD pipeline before starting the app process:
   ```bash
   npx prisma migrate deploy
   ```
3. **Environment Setup**:
   Ensure all production keys (`ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `UPSTASH_REDIS_REST_URL`, etc.) are injected via your cloud platform environment settings.

---

## 13. Operational Notes

* **Liveness & Readiness Health Probes**:
  * `/api/health/live`: Returns `200` to indicate the process is running.
  * `/api/health/ready`: Returns `200` if PostgreSQL, Redis cache, and external APIs are fully reachable. Degrades to `503` if DB goes down.
* **Logging System**:
  Structured JSON logging is enabled using specific domain-focused loggers (`logger.auth`, `logger.ai`, `logger.security`). These logs output directly to `stdout`/`stderr` and can be collected by platforms like Datadog or CloudWatch.
* **Disaster Recovery**:
  To backup and restore your database state:
  ```bash
  # Backup schema and records
  npm run db:backup
  
  # Restore back into database
  npm run db:restore
  ```
