import { ConversationRepository } from '@/server/repositories/conversation.repository'
import { MessageRepository } from '@/server/repositories/message.repository'
import { createChatCompletionText } from '@/server/services/ai/siliconflow'
import { estimateTokens } from '@/server/services/rag/chunker'
import type { RagContext } from '@/server/services/rag/types'
import type { ContextCompressionResult, ContextUsage } from '@/lib/types/context-usage'

const RECENT_MESSAGE_LIMIT = 16
const MIN_MESSAGES_TO_SUMMARIZE = 10
const SUMMARY_BATCH_LIMIT = 64
const MAX_SUMMARY_ROUNDS = 4
const MAX_SUMMARY_CHARS = 5000
const MAX_SUMMARY_INPUT_CHARS = 24000
const MAX_HISTORY_MESSAGE_CHARS = 3000
const MAX_ATTACHMENT_CHARS = 6000
const MAX_ATTACHMENTS_TOTAL_CHARS = 12000
const SYSTEM_AND_WRAPPER_ESTIMATED_CHARS = 2600

type HistoryMessage = {
  id?: string
  role: string
  content: string
  thinking?: string | null
  createdAt?: Date
}

type ConversationContextState = {
  id: string
  summary?: string | null
  summaryUntil?: Date | null
  summaryUpdatedAt?: Date | null
}

export interface ManagedConversationContext {
  summary: string | null
  historyMessages: Array<{ role: string; content: string }>
  currentUserMessage: string
  usage: ContextUsage
  conversation: ConversationContextState
}

export async function buildManagedConversationContext(input: {
  conversation: ConversationContextState
  apiKey: string
  model: string
  currentContent: string
  currentUserCreatedAt: Date
  currentUserMessagePersisted: boolean
  attachments?: Array<{ name: string; content: string }>
}): Promise<ManagedConversationContext> {
  const conversation = await refreshConversationSummary({
    conversation: input.conversation,
    apiKey: input.apiKey,
    model: input.model,
    before: input.currentUserCreatedAt,
  })

  const historyMessages = dedupeCurrentUserFromHistory(
    await MessageRepository.findCompletedBefore(
      conversation.id,
      input.currentUserCreatedAt,
      {
        after: conversation.summaryUntil,
        limit: RECENT_MESSAGE_LIMIT + MIN_MESSAGES_TO_SUMMARIZE - 1,
      }
    ),
    input.currentContent,
    input.currentUserMessagePersisted
  )

  return {
    summary: conversation.summary?.trim() || null,
    historyMessages: compactHistoryMessages(historyMessages),
    currentUserMessage: appendAttachmentsWithinBudget(input.currentContent, input.attachments),
    usage: await buildContextUsage({
      conversation,
      historyMessages,
      currentUserMessage: input.currentContent,
      attachments: input.attachments,
      mode: 'request',
    }),
    conversation,
  }
}

export async function buildRequestContextUsage(input: {
  conversation: ConversationContextState
  historyMessages: Array<{ role: string; content: string }>
  currentUserMessage: string
  attachments?: Array<{ name: string; content: string }>
  ragContext?: RagContext | null
}): Promise<ContextUsage> {
  return buildContextUsage({
    conversation: input.conversation,
    historyMessages: input.historyMessages,
    currentUserMessage: input.currentUserMessage,
    attachments: input.attachments,
    ragContext: input.ragContext,
    mode: 'request',
  })
}

export async function getConversationContextUsage(input: {
  conversation: ConversationContextState
}): Promise<ContextUsage> {
  const historyMessages = await MessageRepository.findCompletedBefore(
    input.conversation.id,
    new Date(),
    {
      after: input.conversation.summaryUntil,
      limit: RECENT_MESSAGE_LIMIT,
    }
  )

  return buildContextUsage({
    conversation: input.conversation,
    historyMessages,
    currentUserMessage: '',
    mode: 'conversation',
  })
}

export async function compressConversationContext(input: {
  conversation: ConversationContextState
  apiKey: string
  model: string
}): Promise<ContextCompressionResult> {
  const before = new Date()
  const previousSummaryUntil = input.conversation.summaryUntil ?? null
  const previousCompressedMessages = previousSummaryUntil
    ? await MessageRepository.countCompletedInRange(input.conversation.id, {
        before: previousSummaryUntil,
        includeBefore: true,
      })
    : 0
  const conversation = await refreshConversationSummary({
    conversation: input.conversation,
    apiKey: input.apiKey,
    model: input.model,
    before,
    force: true,
  })
  const contextUsage = await getConversationContextUsage({ conversation })
  const compressed = Boolean(
    conversation.summaryUntil &&
    (!previousSummaryUntil || conversation.summaryUntil.getTime() > previousSummaryUntil.getTime())
  )

  return {
    compressed,
    summarizedMessages: compressed ? Math.max(contextUsage.compressedMessages - previousCompressedMessages, 0) : 0,
    contextUsage,
    message: compressed ? '上下文已压缩。' : '当前暂无可压缩的旧消息。',
  }
}

async function refreshConversationSummary(input: {
  conversation: ConversationContextState
  apiKey: string
  model: string
  before: Date
  force?: boolean
}): Promise<ConversationContextState> {
  let working: ConversationContextState = { ...input.conversation }
  let updated = false

  try {
    for (let round = 0; round < MAX_SUMMARY_ROUNDS; round += 1) {
      const messagesToSummarize = await MessageRepository.findMessagesForSummary(
        input.conversation.id,
        {
          after: working.summaryUntil,
          before: input.before,
          keepRecent: RECENT_MESSAGE_LIMIT,
          limit: SUMMARY_BATCH_LIMIT,
        }
      )

      if (!input.force && messagesToSummarize.length < MIN_MESSAGES_TO_SUMMARIZE) break
      if (input.force && messagesToSummarize.length === 0) break

      const lastSummarizedMessage = messagesToSummarize[messagesToSummarize.length - 1]
      if (!lastSummarizedMessage?.createdAt) break

      const summary = await summarizeConversationSlice({
        apiKey: input.apiKey,
        model: input.model,
        existingSummary: working.summary,
        messages: messagesToSummarize,
      })

      if (!summary) break

      working = {
        ...working,
        summary,
        summaryUntil: lastSummarizedMessage.createdAt,
      }
      updated = true

      if (messagesToSummarize.length < SUMMARY_BATCH_LIMIT) break
    }

    if (!updated || !working.summary || !working.summaryUntil) {
      return input.conversation
    }

    return ConversationRepository.updateSummary(input.conversation.id, {
      summary: working.summary,
      summaryUntil: working.summaryUntil,
    })
  } catch (error) {
    console.error('[ContextManager] Failed to refresh conversation summary:', error)
    return input.conversation
  }
}

async function summarizeConversationSlice(input: {
  apiKey: string
  model: string
  existingSummary?: string | null
  messages: HistoryMessage[]
}): Promise<string> {
  const existingSummary = input.existingSummary?.trim()
  const transcript = formatMessagesForSummary(input.messages)

  const summary = await createChatCompletionText(input.apiKey, {
    model: input.model,
    maxTokens: 1200,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: [
          '你负责维护一份长期对话记忆摘要，用于后续 AI 回答。',
          '请把已有摘要与新增对话合并，输出简洁但信息密集的中文摘要。',
          '必须保留：用户长期目标、明确偏好、重要事实、已完成/未完成任务、关键决策、文件名/接口/配置等可复用上下文。',
          '不要记录无意义寒暄、重复确认、临时错误日志，除非它影响后续工作。',
          `摘要总长度不要超过 ${MAX_SUMMARY_CHARS} 个字符。`,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          '<existing_summary>',
          existingSummary || '暂无',
          '</existing_summary>',
          '',
          '<new_messages>',
          transcript,
          '</new_messages>',
          '',
          '请输出更新后的长期对话摘要，不要添加解释性前后缀。',
        ].join('\n'),
      },
    ],
  })

  return clampText(summary, MAX_SUMMARY_CHARS)
}

function formatMessagesForSummary(messages: HistoryMessage[]): string {
  const parts: string[] = []
  let used = 0

  for (const message of messages) {
    const prefix = `${roleLabel(message.role)}: `
    const available = Math.max(MAX_SUMMARY_INPUT_CHARS - used - prefix.length - 2, 0)
    if (available <= 0) break

    const content = clampText(normalizeMessageContent(message), Math.min(available, MAX_HISTORY_MESSAGE_CHARS))
    if (!content) continue

    const part = `${prefix}${content}`
    parts.push(part)
    used += part.length + 2
  }

  return parts.join('\n\n')
}

function compactHistoryMessages(messages: HistoryMessage[]): Array<{ role: string; content: string }> {
  return messages
    .map((message) => ({
      role: normalizeRole(message.role),
      content: clampText(normalizeMessageContent(message), MAX_HISTORY_MESSAGE_CHARS),
    }))
    .filter((message) => message.content.length > 0)
}

function appendAttachmentsWithinBudget(
  content: string,
  attachments?: Array<{ name: string; content: string }>
): string {
  if (!attachments || attachments.length === 0) {
    return content
  }

  let used = 0
  const fileContents: string[] = []

  for (const file of attachments) {
    if (used >= MAX_ATTACHMENTS_TOTAL_CHARS) break

    const reserve = 80 + file.name.length
    const available = Math.min(
      MAX_ATTACHMENT_CHARS,
      Math.max(MAX_ATTACHMENTS_TOTAL_CHARS - used - reserve, 0)
    )
    if (available <= 0) break

    const fileContent = clampText(file.content, available)
    used += fileContent.length + reserve
    fileContents.push(`\n\n---\n**附件: ${file.name}**\n\`\`\`\n${fileContent}\n\`\`\``)
  }

  return content + fileContents.join('\n')
}

function getAttachmentContentsWithinBudget(
  attachments?: Array<{ name: string; content: string }>
): string {
  if (!attachments || attachments.length === 0) {
    return ''
  }

  let used = 0
  const fileContents: string[] = []

  for (const file of attachments) {
    if (used >= MAX_ATTACHMENTS_TOTAL_CHARS) break

    const reserve = 80 + file.name.length
    const available = Math.min(
      MAX_ATTACHMENT_CHARS,
      Math.max(MAX_ATTACHMENTS_TOTAL_CHARS - used - reserve, 0)
    )
    if (available <= 0) break

    const fileContent = clampText(file.content, available)
    used += fileContent.length + reserve
    fileContents.push(fileContent)
  }

  return fileContents.join('\n\n')
}

async function buildContextUsage(input: {
  conversation: ConversationContextState
  historyMessages: HistoryMessage[]
  currentUserMessage: string
  attachments?: Array<{ name: string; content: string }>
  ragContext?: RagContext | null
  mode: ContextUsage['mode']
}): Promise<ContextUsage> {
  const summary = input.conversation.summary?.trim() || ''
  const activeHistoryMessages = compactHistoryMessages(input.historyMessages)
  const activeHistoryChars = activeHistoryMessages.reduce((sum, message) => sum + message.content.length, 0)
  const currentMessageChars = input.currentUserMessage.length
  const attachmentContent = getAttachmentContentsWithinBudget(input.attachments)
  const attachmentChars = attachmentContent.length
  const currentRequestText = input.currentUserMessage + (attachmentContent ? `\n\n${attachmentContent}` : '')
  const ragChars = input.ragContext?.contextText.length ?? 0
  const compressedMessages = input.conversation.summaryUntil
    ? await MessageRepository.countCompletedInRange(input.conversation.id, {
        before: input.conversation.summaryUntil,
        includeBefore: true,
      })
    : 0
  const messagesAfterSummary = await MessageRepository.countCompletedInRange(input.conversation.id, {
    after: input.conversation.summaryUntil,
  })
  const compressibleMessages = Math.max(messagesAfterSummary - RECENT_MESSAGE_LIMIT, 0)
  const systemAndWrapperChars = summary || ragChars ? SYSTEM_AND_WRAPPER_ESTIMATED_CHARS : 1800

  return {
    mode: input.mode,
    generatedAt: new Date().toISOString(),
    hasSummary: summary.length > 0,
    summaryChars: summary.length,
    summaryEstimatedTokens: estimateTokens(summary),
    summaryUntil: input.conversation.summaryUntil?.toISOString() ?? null,
    summaryUpdatedAt: input.conversation.summaryUpdatedAt?.toISOString() ?? null,
    compressedMessages,
    messagesAfterSummary,
    activeHistoryMessages: activeHistoryMessages.length,
    activeHistoryChars,
    activeHistoryEstimatedTokens: estimateTokens(activeHistoryMessages.map((message) => message.content).join('\n\n')),
    compressibleMessages,
    currentMessageChars,
    currentMessageEstimatedTokens: estimateTokens(input.currentUserMessage),
    attachmentChars,
    attachmentEstimatedTokens: estimateTokens(attachmentContent),
    ragSources: input.ragContext?.sources.length ?? 0,
    ragChars,
    ragEstimatedTokens: estimateTokens(input.ragContext?.contextText ?? ''),
    systemAndWrapperChars,
    systemAndWrapperEstimatedTokens: estimateTokens('x'.repeat(systemAndWrapperChars)),
    totalChars: summary.length + activeHistoryChars + currentRequestText.length + ragChars + systemAndWrapperChars,
    totalEstimatedTokens:
      estimateTokens(summary) +
      estimateTokens(activeHistoryMessages.map((message) => message.content).join('\n\n')) +
      estimateTokens(currentRequestText) +
      estimateTokens(input.ragContext?.contextText ?? '') +
      estimateTokens('x'.repeat(systemAndWrapperChars)),
    maxRecentMessages: RECENT_MESSAGE_LIMIT,
  }
}

function dedupeCurrentUserFromHistory<T extends HistoryMessage>(
  messages: T[],
  currentContent: string,
  currentUserMessagePersisted: boolean
): T[] {
  if (currentUserMessagePersisted || messages.length === 0) {
    return messages
  }

  const last = messages[messages.length - 1]
  if (last.role === 'user' && last.content.trim() === currentContent.trim()) {
    return messages.slice(0, -1)
  }

  return messages
}

function normalizeMessageContent(message: HistoryMessage): string {
  const content = message.content?.trim() || ''
  const thinking = message.thinking?.trim()
  if (!thinking) return content

  return [content, `【思考摘要】${clampText(thinking, 800)}`]
    .filter(Boolean)
    .join('\n')
}

function normalizeRole(role: string): string {
  if (role === 'assistant' || role === 'user' || role === 'system') {
    return role
  }
  return 'user'
}

function roleLabel(role: string): string {
  if (role === 'assistant') return '助手'
  if (role === 'system') return '系统'
  return '用户'
}

function clampText(text: string, maxChars: number): string {
  const normalized = text.trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(maxChars - 20, 0)).trim()}...（已截断）`
}
