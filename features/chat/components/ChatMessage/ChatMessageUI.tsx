/**
 * Chat Message UI Component - 消息 UI 组件
 * 
 * 纯展示组件，负责渲染单条消息
 * 根据 role 区分用户消息和 AI 消息的渲染方式
 * 
 * @module modules/chat-message/ChatMessageUI
 */

import { useState } from 'react'
import { ThinkingPanel } from '@/features/chat/components/ThinkingPanel'
import { MessageContent } from '@/features/chat/components/MessageContent'
import { MessageActions } from '@/features/chat/components/MessageActions'
import { MessageEdit } from '@/features/chat/components/MessageEdit'
import { Button } from '@/components/ui/button'
import { Loader2, Edit2, RotateCw, ChevronDown, ChevronRight, Globe, XCircle, BookOpen, Gauge } from 'lucide-react'
import { MarkdownIcon } from '@/components/icons/MarkdownIcon'
import { TextFileIcon } from '@/components/icons/TextFileIcon'
import { cn } from '@/lib/utils'
import type { Message, RagMessageContext, ToolInvocation, ToolResult, SearchSource } from '@/features/chat/types/chat'
import type { ContextUsage } from '@/lib/types/context-usage'

/**
 * 搜索状态组件 - 简洁风格，类似 Perplexity
 */
function WebSearchStatus({ invocation }: { invocation: ToolInvocation }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const sources = invocation.result?.sources as SearchSource[] | undefined

  // 搜索中
  if (invocation.state === 'running' || invocation.state === 'pending') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>搜索中...</span>
        {invocation.args?.query && (
          <span className="text-xs opacity-70">&quot;{invocation.args.query}&quot;</span>
        )}
      </div>
    )
  }

  // 失败
  if (invocation.state === 'failed') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <XCircle className="h-3.5 w-3.5" />
        <span>搜索失败</span>
      </div>
    )
  }

  // 完成 - 显示来源标签
  const hasSources = sources && sources.length > 0
  
  return (
    <div className="space-y-2">
      {/* 来源标签行 */}
      {hasSources && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">来源:</span>
          {sources.slice(0, isExpanded ? sources.length : 3).map((source, index) => (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-xs transition-colors group"
            >
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground/80 group-hover:text-foreground max-w-[120px] truncate">
                {new URL(source.url).hostname.replace('www.', '')}
              </span>
            </a>
          ))}
          {sources.length > 3 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {isExpanded ? (
                <>收起 <ChevronDown className="h-3 w-3" /></>
              ) : (
                <>+{sources.length - 3} 更多 <ChevronRight className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 渲染单个工具调用
 * 图片生成完成后会直接插入到 content 流中，这里只显示 loading 状态
 */
function ToolInvocationItem({ invocation }: { invocation: ToolInvocation }) {
  // 图片生成 - 只显示 loading 和失败状态
  if (invocation.name === 'generate_image') {
    if (invocation.state === 'running' || invocation.state === 'pending') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>正在生成图片...</span>
        </div>
      )
    }
    if (invocation.state === 'failed') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" />
          <span>图片生成失败</span>
        </div>
      )
    }
    // 完成状态不渲染，图片已插入到 content 中
    return null
  }

  // 搜索工具
  if (invocation.name === 'web_search') {
    return <WebSearchStatus invocation={invocation} />
  }

  return null
}

/**
 * 渲染持久化的工具结果
 * 方案 A：图片在 content 中渲染，这里不单独显示
 */
function ToolResultItem({ result }: { result: ToolResult }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // 图片生成结果不在这里渲染，会在 content 的 markdown 中显示
  if (result.name === 'generate_image') {
    return null
  }

  // 搜索结果 - 简洁的来源标签
  if (result.name === 'web_search' && result.result.sources && result.result.sources.length > 0) {
    const sources = result.result.sources as SearchSource[]
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">来源:</span>
        {sources.slice(0, isExpanded ? sources.length : 3).map((source, index) => (
          <a
            key={index}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-xs transition-colors group"
          >
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-foreground/80 group-hover:text-foreground max-w-[120px] truncate">
              {new URL(source.url).hostname.replace('www.', '')}
            </span>
          </a>
        ))}
        {sources.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {isExpanded ? (
              <>收起 <ChevronDown className="h-3 w-3" /></>
            ) : (
              <>+{sources.length - 3} 更多 <ChevronRight className="h-3 w-3" /></>
            )}
          </button>
        )}
      </div>
    )
  }
  
  return null
}

function RagSources({ ragContext }: { ragContext: RagMessageContext }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const sources = ragContext.sources || []
  if (sources.length === 0) return null

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>知识库引用 {sources.length}</span>
        <span className="ml-auto">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {sources.map((source) => (
            <div key={source.chunkId} className="rounded-md bg-background/70 p-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 shrink-0 items-center rounded bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  #{source.index}
                </span>
                <span className="truncate font-medium">{source.fileName}</span>
                <span className="text-muted-foreground">切片 {source.chunkIndex}</span>
              </div>
              {source.heading && (
                <div className="mt-1 text-muted-foreground">{source.heading}</div>
              )}
              <p className="mt-1 line-clamp-3 text-muted-foreground">{source.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MessageContextUsage({ usage }: { usage: ContextUsage }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <Gauge className="h-3.5 w-3.5" />
        <span>本次上下文约 {formatNumber(usage.totalEstimatedTokens)} Token</span>
        <span className="ml-auto">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {isExpanded && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ContextUsageItem label="摘要" value={usage.hasSummary ? `${formatNumber(usage.summaryEstimatedTokens)} Token` : '未启用'} />
          <ContextUsageItem label="历史" value={`${usage.activeHistoryMessages} 条 / ${formatNumber(usage.activeHistoryEstimatedTokens)} Token`} />
          <ContextUsageItem label="当前消息" value={`${formatNumber(usage.currentMessageEstimatedTokens)} Token`} />
          <ContextUsageItem label="知识库" value={`${usage.ragSources} 段 / ${formatNumber(usage.ragEstimatedTokens)} Token`} />
        </div>
      )}
    </div>
  )
}

function ContextUsageItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium text-foreground">{value}</div>
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

interface ChatMessageUIProps {
  /** 消息数据 */
  message: Message
  
  /** 是否正在流式传输 thinking */
  isStreamingThinking: boolean
  
  /** 是否正在流式传输 answer */
  isStreamingAnswer: boolean
  
  /** 是否正在等待响应 */
  isWaitingForResponse: boolean
  
  /** 是否是最后一条助手消息 */
  isLastAssistantMessage?: boolean
  
  /** 重试回调 */
  onRetry?: () => void
  
  /** 编辑并重新发送回调 */
  onEdit?: (newContent: string) => void
}

/**
 * 消息 UI 组件
 * 
 * 渲染单条消息，根据 role 区分样式
 * - user: 右对齐蓝色气泡
 * - assistant: 左对齐，包含 thinking 和 answer 区域
 */
export function ChatMessageUI({
  message,
  isStreamingThinking,
  isStreamingAnswer,
  onRetry,
  onEdit,
}: ChatMessageUIProps) {
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)

  // 获取消息显示状态
  const displayState = message.displayState || 'idle'

  // 根据 displayState 计算实际的显示状态
  const isActuallyStreaming = displayState === 'streaming' || isStreamingThinking || isStreamingAnswer
  
  // ============ 用户消息 ============
  if (isUser) {
    return (
      <div className="w-full py-4 group">
        <div className="flex justify-end items-start gap-2">
          {/* 编辑按钮（hover显示） */}
          {onEdit && !isEditing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity mt-2"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}

          <div className="max-w-[70%] flex flex-col items-end gap-2">
            {/* 文件附件标签 */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {message.attachments.map((file, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs",
                      file.type === 'md'
                        ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                        : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    )}
                  >
                    {file.type === 'md' ? (
                      <MarkdownIcon className="h-3 w-3 text-orange-500" />
                    ) : (
                      <TextFileIcon className="h-3 w-3 text-blue-500" />
                    )}
                    <span className={cn(
                      "font-medium",
                      file.type === 'md'
                        ? "text-orange-700 dark:text-orange-300"
                        : "text-blue-700 dark:text-blue-300"
                    )}>
                      {file.name}
                    </span>
                    <span className={cn(
                      "text-xs",
                      file.type === 'md'
                        ? "text-orange-500 dark:text-orange-400"
                        : "text-blue-500 dark:text-blue-400"
                    )}>
                      {(file.size / 1024).toFixed(1)}KB
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 消息内容 */}
            {isEditing ? (
              <MessageEdit
                originalContent={message.content}
                onCancel={() => setIsEditing(false)}
                onSend={(newContent) => {
                  setIsEditing(false)
                  onEdit?.(newContent)
                }}
              />
            ) : (
              <div className="rounded-3xl bg-[hsl(var(--message-user-bg))] px-5 py-3">
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-[hsl(var(--text-primary))]">
                  {message.content}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
  
  // ============ AI 消息 ============

  // 根据 displayState 决定显示内容
  const showWaitingIndicator = displayState === 'waiting' && !message.thinking && !message.content
  const showErrorIndicator = (displayState === 'error' || message.hasError) && !message.content

  return (
    <div className="w-full py-6">
        <div className="space-y-4">
          {/* Waiting 状态：等待响应 */}
          {showWaitingIndicator && (
            <div className="flex items-center gap-2 text-[hsl(var(--text-secondary))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">等待响应...</span>
            </div>
          )}

          {/* Error 状态：显示错误提示 */}
          {showErrorIndicator && (
            <div className="flex items-center gap-2 text-red-500">
              <span className="text-sm">生成失败</span>
            </div>
          )}

          {/* 工具调用状态（运行时，支持多个并行） */}
          {message.toolInvocations?.map((invocation) => (
            <ToolInvocationItem key={invocation.toolCallId} invocation={invocation} />
          ))}

          {/* 工具执行结果（持久化后，从数据库加载） */}
          {!message.toolInvocations?.length && message.toolResults?.map((result) => (
            <ToolResultItem key={result.toolCallId} result={result} />
          ))}

          {/* Thinking 面板（独立组件） */}
          {message.thinking && (
            <ThinkingPanel
              content={message.thinking}
              isStreaming={isActuallyStreaming && isStreamingThinking}
              defaultExpanded={true}
            />
          )}

          {/* Answer 内容 */}
          {message.content && (
            <div className="prose-container">
              <MessageContent
                content={message.content}
                isStreaming={isActuallyStreaming && isStreamingAnswer}
                showCursor={isActuallyStreaming}
              />
            </div>
          )}

          {/* 操作按钮 */}
          {/* 流式传输时：只显示重试按钮（用于中断） */}
          {/* 非流式传输时：显示所有操作按钮（复制、朗读、重试） */}
          {message.ragContext && <RagSources ragContext={message.ragContext} />}

          {message.contextUsage && <MessageContextUsage usage={message.contextUsage} />}

          {isActuallyStreaming && onRetry ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onRetry}
                className="h-7 w-7 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="重试"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          ) : message.content ? (
            <MessageActions
              content={message.content}
              messageId={message.id}
              role={message.role as 'user' | 'assistant'}
              hasError={message.hasError}
              onRetry={onRetry}
            />
          ) : null}
      </div>
    </div>
  )
}

