'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ChevronDown, ChevronRight, Gauge, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContextService } from '@/features/chat/services/context.service'
import { useChatStore } from '@/features/chat/store/chat.store'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ContextUsage } from '@/lib/types/context-usage'

interface ContextUsagePanelProps {
  conversationId: string
}

export function ContextUsagePanel({ conversationId }: ContextUsagePanelProps) {
  const selectedModel = useChatStore((state) => state.selectedModel)
  const latestRequestUsage = useChatStore((state) => {
    for (let index = state.messages.length - 1; index >= 0; index -= 1) {
      const message = state.messages[index]
      if (message?.role === 'assistant' && message.conversationId === conversationId && message.contextUsage) {
        return message.contextUsage
      }
    }
    return null
  })
  const [usage, setUsage] = useState<ContextUsage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { toast } = useToast()

  const visibleUsage = pickLatestUsage(usage, latestRequestUsage)
  const isRequestUsage = visibleUsage?.mode === 'request'

  const loadUsage = useCallback(async () => {
    if (!conversationId) return
    setIsLoading(true)
    try {
      setUsage(await ContextService.getUsage(conversationId))
    } catch (error) {
      console.error('[ContextUsagePanel] Failed to load context usage:', error)
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    setUsage(null)
    setIsExpanded(false)
    void loadUsage()
  }, [conversationId, loadUsage])

  const handleCompress = async () => {
    if (!conversationId || isCompressing) return
    setIsCompressing(true)
    try {
      const result = await ContextService.compress(conversationId, selectedModel)
      setUsage(result.contextUsage)
      toast({
        title: result.compressed ? '上下文已压缩' : '暂无可压缩内容',
        description: result.compressed
          ? `已压缩 ${result.summarizedMessages} 条旧消息。`
          : result.message,
        variant: result.compressed ? 'success' : 'default',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '压缩失败'
      toast({
        title: '上下文压缩失败',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsCompressing(false)
    }
  }

  const usageRatioLabel = useMemo(() => {
    if (!visibleUsage) return '上下文状态'
    return `约 ${formatNumber(visibleUsage.totalEstimatedTokens)} Token`
  }, [visibleUsage])

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-2">
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            className="inline-flex min-w-0 items-center gap-2 text-left hover:text-foreground"
          >
            <Gauge className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">上下文</span>
            <span>{isLoading && !visibleUsage ? '读取中...' : usageRatioLabel}</span>
            {isRequestUsage && <span className="hidden sm:inline">本次请求</span>}
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {visibleUsage && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Metric label="摘要" value={visibleUsage.hasSummary ? '已启用' : '未启用'} />
              <Metric label="历史" value={`${visibleUsage.activeHistoryMessages} 条`} />
              {visibleUsage.ragSources > 0 && <Metric label="知识库" value={`${visibleUsage.ragSources} 段`} />}
              {visibleUsage.compressibleMessages > 0 && (
                <Metric label="可压缩" value={`${visibleUsage.compressibleMessages} 条`} accent />
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadUsage}
              disabled={isLoading || isCompressing}
              className="h-7 px-2"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCompress}
              disabled={isCompressing || isLoading}
              className="h-7 px-2"
            >
              {isCompressing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              压缩上下文
            </Button>
          </div>
        </div>

        {visibleUsage && isExpanded && (
          <div className="mt-2 grid gap-2 border-t pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="总计" value={`约 ${formatNumber(visibleUsage.totalEstimatedTokens)} Token`} />
            <Detail label="摘要记忆" value={`${formatNumber(visibleUsage.summaryEstimatedTokens)} Token`} />
            <Detail label="最近历史" value={`${visibleUsage.activeHistoryMessages} 条 / ${formatNumber(visibleUsage.activeHistoryEstimatedTokens)} Token`} />
            <Detail label="当前消息" value={`${formatNumber(visibleUsage.currentMessageEstimatedTokens)} Token`} />
            <Detail label="附件" value={`${formatNumber(visibleUsage.attachmentEstimatedTokens)} Token`} />
            <Detail label="知识库" value={`${visibleUsage.ragSources} 段 / ${formatNumber(visibleUsage.ragEstimatedTokens)} Token`} />
            <Detail label="已压缩" value={`${visibleUsage.compressedMessages} 条消息`} />
            <Detail label="摘要更新时间" value={formatDateTime(visibleUsage.summaryUpdatedAt)} />
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded bg-background/70 px-1.5 py-0.5', accent && 'text-amber-700 dark:text-amber-300')}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/70 px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-medium text-foreground">{value}</div>
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function pickLatestUsage(
  conversationUsage: ContextUsage | null,
  requestUsage: ContextUsage | null
): ContextUsage | null {
  if (!conversationUsage) return requestUsage
  if (!requestUsage) return conversationUsage

  return new Date(requestUsage.generatedAt).getTime() > new Date(conversationUsage.generatedAt).getTime()
    ? requestUsage
    : conversationUsage
}

function formatDateTime(value: string | null): string {
  if (!value) return '暂无'
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
