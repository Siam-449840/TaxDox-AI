// TaxDox AI — Email Template Generators
// Simulated email content for client communications.
// Each generator returns { subject, body, template } with professional
// plain-text content suitable for both on-screen preview and SMTP delivery.

export type EmailTemplate =
  | 'pbc_request'
  | 'deadline_reminder'
  | 'document_received'
  | 'extraction_complete'
  | 'welcome'

export interface EmailContent {
  subject: string
  body: string
  template: EmailTemplate
}

const FIRM_SIGNATURE = `Best regards,
The Meridian CPA Group Team
portal.meridiancpa.com · (415) 555-0100`

function formatDeadline(deadline: string | Date): string {
  try {
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return String(deadline)
  }
}

/**
 * PBC document request — sent to the client when a PBC list is dispatched.
 */
export function pbcRequestEmail(
  clientName: string,
  engagementType: string,
  taxYear: number,
  deadline: string | Date
): EmailContent {
  const due = formatDeadline(deadline)
  return {
    template: 'pbc_request',
    subject: `Action Required: Document Request for Your ${engagementType} Tax Return (${taxYear})`,
    body: `Dear ${clientName},

We are preparing your ${engagementType} tax return for tax year ${taxYear}. To get started, please upload the requested documents through our secure client portal.

Deadline: ${due}

What you need to do
─────────────────────
1. Click the secure portal link below to open your engagement workspace.
2. Review the list of requested documents in the "PBC List" tab.
3. Upload each document (PDF, photo, or scan) by dragging it onto the upload zone.
4. Our AI will automatically classify and extract the key fields — usually within a minute.
5. You will receive a confirmation email once each document is processed.

Secure portal: https://portal.meridiancpa.com

If you have any questions, just reply to this email or message us directly in the portal and a member of our team will respond within one business day.

${FIRM_SIGNATURE}`,
  }
}

/**
 * Deadline reminder — sent when the engagement deadline is approaching.
 */
export function deadlineReminderEmail(
  clientName: string,
  engagementType: string,
  taxYear: number,
  daysLeft: number,
  deadline: string | Date
): EmailContent {
  const due = formatDeadline(deadline)
  const urgency =
    daysLeft <= 3
      ? 'URGENT: This is a final reminder'
      : daysLeft <= 7
        ? 'Friendly reminder'
        : 'Quick reminder'
  return {
    template: 'deadline_reminder',
    subject: `${urgency}: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to submit documents for your ${engagementType} (${taxYear})`,
    body: `Dear ${clientName},

${urgency} — your ${engagementType} tax return for tax year ${taxYear} is due on ${due}, which is ${daysLeft} day${daysLeft === 1 ? '' : 's'} away.

We still need a few documents from you before we can finalize your return. Please log in to the secure client portal and upload any outstanding items from your PBC list as soon as possible.

Secure portal: https://portal.meridiancpa.com

Documents received to date are listed in your portal. If you have already uploaded everything, thank you — you can disregard this message and we will be in touch shortly with next steps.

If you anticipate any delay, please let us know right away so we can plan accordingly and help you avoid late-filing penalties.

${FIRM_SIGNATURE}`,
  }
}

/**
 * Document received — sent to the client when they upload a document.
 */
export function documentReceivedEmail(
  clientName: string,
  documentType: string,
  filename: string
): EmailContent {
  return {
    template: 'document_received',
    subject: `Document received: ${documentType}`,
    body: `Dear ${clientName},

We have received your ${documentType} document and added it to your engagement workspace.

File: ${filename}

What happens next
─────────────────────
1. Our AI engine will classify the document and extract the key fields automatically.
2. A preparer will review the extracted data for accuracy.
3. You will receive another confirmation once the document has been processed.

You can track the status of all your documents in real time in the secure client portal.

Secure portal: https://portal.meridiancpa.com

If you did not upload this document, or if it was sent in error, please reply to this email so we can remove it from your file.

${FIRM_SIGNATURE}`,
  }
}

/**
 * Extraction complete — sent when AI extraction finishes on a document.
 */
export function extractionCompleteEmail(
  clientName: string,
  documentType: string,
  fieldCount: number,
  confidence: number
): EmailContent {
  const pct = Math.round(confidence * 100)
  return {
    template: 'extraction_complete',
    subject: `AI extraction complete: ${documentType} (${fieldCount} fields, ${pct}% confidence)`,
    body: `Dear ${clientName},

We have finished AI-extracting the data from your ${documentType} document.

Summary
─────────────────────
• Fields extracted: ${fieldCount}
• Average confidence: ${pct}%
• Document type detected: ${documentType}

Our AI engine parsed the document and structured the key information so your preparer can review it efficiently. A member of our team will verify the extracted data and reach out if anything looks unclear or needs follow-up.

You can review the extracted data in the secure client portal at any time.

Secure portal: https://portal.meridiancpa.com

${FIRM_SIGNATURE}`,
  }
}

/**
 * Welcome — sent to a newly created client.
 */
export function welcomeEmail(clientName: string, firmName: string): EmailContent {
  return {
    template: 'welcome',
    subject: `Welcome to ${firmName}! Here's how to get started`,
    body: `Dear ${clientName},

Welcome to ${firmName}! We are thrilled to have you on board and look forward to making this tax season the smoothest one yet.

What you can do in the client portal
─────────────────────────────────────────
1. View your active engagements and their status.
2. Upload tax documents securely (PDF, photo, or scan).
3. Track AI extraction progress in real time.
4. Message your preparer directly — no email back-and-forth needed.
5. Review extracted data and approve it for filing.

Secure portal: https://portal.meridiancpa.com

Your dedicated preparer will reach out shortly with your personalized document request list (PBC list). In the meantime, feel free to log in and explore the portal.

If you have any questions, simply reply to this email and we will be glad to help.

${FIRM_SIGNATURE}`,
  }
}

/**
 * Registry of all available templates for the Settings UI.
 */
export const EMAIL_TEMPLATES: {
  key: EmailTemplate
  label: string
  description: string
  builder: (...args: never[]) => EmailContent
}[] = [
  {
    key: 'pbc_request',
    label: 'PBC Document Request',
    description: 'Sent when a PBC list is dispatched to the client.',
    builder: pbcRequestEmail as (...args: never[]) => EmailContent,
  },
  {
    key: 'deadline_reminder',
    label: 'Deadline Reminder',
    description: 'Sent when an engagement deadline is approaching.',
    builder: deadlineReminderEmail as (...args: never[]) => EmailContent,
  },
  {
    key: 'document_received',
    label: 'Document Received',
    description: 'Sent when the client uploads a new document.',
    builder: documentReceivedEmail as (...args: never[]) => EmailContent,
  },
  {
    key: 'extraction_complete',
    label: 'AI Extraction Complete',
    description: 'Sent when AI extraction finishes on a document.',
    builder: extractionCompleteEmail as (...args: never[]) => EmailContent,
  },
  {
    key: 'welcome',
    label: 'Client Welcome',
    description: 'Sent to a newly created client.',
    builder: welcomeEmail as (...args: never[]) => EmailContent,
  },
]

/**
 * Map of template → tailwind color name used by the SentEmailsPanel badges.
 */
export const EMAIL_TEMPLATE_COLORS: Record<EmailTemplate, string> = {
  pbc_request: 'blue',
  deadline_reminder: 'amber',
  document_received: 'teal',
  extraction_complete: 'violet',
  welcome: 'emerald',
}

/**
 * Map of template → human-readable label (used for badges).
 */
export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplate, string> = {
  pbc_request: 'PBC Request',
  deadline_reminder: 'Deadline Reminder',
  document_received: 'Document Received',
  extraction_complete: 'Extraction Complete',
  welcome: 'Welcome',
}
