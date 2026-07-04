/**
 * TaxDox AI — AI module barrel.
 *
 * Application code imports ONLY from here. Never import a provider directly.
 */
export { getAIGateway } from './gateway'
export type {
  AIProvider,
  ClassifyInput,
  ClassifyResult,
  ExtractInput,
  ExtractionResult,
  ExtractedField,
  ChatMessage,
  ChatResult,
  HealthResult,
  ProviderMeta,
  ProviderErrorKind,
} from './types'
export { ProviderError } from './types'
