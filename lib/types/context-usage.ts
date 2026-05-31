export interface ContextUsage {
  mode: 'conversation' | 'request'
  generatedAt: string
  hasSummary: boolean
  summaryChars: number
  summaryEstimatedTokens: number
  summaryUntil: string | null
  summaryUpdatedAt: string | null
  compressedMessages: number
  messagesAfterSummary: number
  activeHistoryMessages: number
  activeHistoryChars: number
  activeHistoryEstimatedTokens: number
  compressibleMessages: number
  currentMessageChars: number
  currentMessageEstimatedTokens: number
  attachmentChars: number
  attachmentEstimatedTokens: number
  ragSources: number
  ragChars: number
  ragEstimatedTokens: number
  systemAndWrapperChars: number
  systemAndWrapperEstimatedTokens: number
  totalChars: number
  totalEstimatedTokens: number
  maxRecentMessages: number
}

export interface ContextCompressionResult {
  compressed: boolean
  summarizedMessages: number
  contextUsage: ContextUsage
  message: string
}
