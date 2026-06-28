// TaxDox AI — Shared TypeScript types

export type ViewKey =
  | 'dashboard'
  | 'clients'
  | 'engagements'
  | 'documents'
  | 'reports'
  | 'calendar'
  | 'client-portal'
  | 'settings'
  | 'engagement-detail'
  | 'document-detail'
  | 'pbc-list'

export type ClientType = 'individual' | 'business' | 'trust' | 'nonprofit'
export type EngagementType = '1040' | '1065' | '1120' | '1120S' | '1041'
export type EngagementStatus =
  | 'created'
  | 'pbc_sent'
  | 'collecting'
  | 'processing'
  | 'review'
  | 'filing'
  | 'done'
export type Priority = 'high' | 'medium' | 'low'
export type PbcItemStatus =
  | 'pending'
  | 'uploaded'
  | 'processing'
  | 'extracted'
  | 'reviewed'
  | 'rejected'
export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'reviewed'
  | 'rejected'
export type UserRole = 'partner' | 'manager' | 'preparer' | 'admin' | 'read-only'

export interface Firm {
  id: string
  name: string
  subscriptionTier: string
  country: string
  settings: Record<string, unknown>
  createdAt: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  email: string
  capacity: number
  currentLoad: number
  avatar?: string
  color: string
}

export interface Client {
  id: string
  firmId: string
  name: string
  email: string
  phone?: string
  taxId?: string
  clientType: ClientType
  status: string
  country: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  _count?: { engagements: number; documents: number }
}

export interface Engagement {
  id: string
  firmId: string
  clientId: string
  client?: Client
  taxYear: number
  engagementType: EngagementType
  status: EngagementStatus
  assignedToId?: string
  assignedTo?: TeamMember | null
  deadline?: string
  priority: Priority
  progress: number
  fee: number
  notes?: string
  createdAt: string
  updatedAt: string
  _count?: {
    documents: number
    pbcItems: number
    pbcCompleted: number
    messages: number
  }
}

export interface PbcList {
  id: string
  engagementId: string
  name: string
  sentAt?: string
  sentVia?: string
  items: PbcItem[]
}

export interface PbcItem {
  id: string
  pbcListId: string
  documentType: string
  description: string
  category: string
  required: boolean
  priority: Priority
  expectedFormat: string
  orderIndex: number
  status: PbcItemStatus
  notes?: string
  documents?: TaxDocument[]
}

export interface TaxDocument {
  id: string
  clientId: string
  engagementId?: string
  pbcItemId?: string
  originalFilename: string
  storedFilename: string
  fileSize: number
  mimeType: string
  documentType?: string
  confidence: number
  status: DocumentStatus
  uploadedBy: string
  uploadedAt: string
  processedAt?: string
  extractions?: Extraction[]
  client?: Client
  engagement?: Engagement
}

export interface Extraction {
  id: string
  documentId: string
  fieldName: string
  fieldLabel: string
  fieldValue: string
  fieldGroup: string
  confidence: number
  sourceLocation?: string
  isVerified: boolean
  verifiedAt?: string
  createdAt: string
}

export interface Workflow {
  id: string
  engagementId: string
  step: string
  status: string
  assignedToId?: string
  startedAt?: string
  completedAt?: string
}

export interface Activity {
  id: string
  engagementId?: string
  documentId?: string
  type: string
  description: string
  actor: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface Message {
  id: string
  engagementId?: string
  clientId?: string
  fromType: string
  content: string
  read: boolean
  createdAt: string
}

export interface AuditLog {
  id: string
  firmId: string
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  details: Record<string, unknown>
  ipAddress?: string
  createdAt: string
}
