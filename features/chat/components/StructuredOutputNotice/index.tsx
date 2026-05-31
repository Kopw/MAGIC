'use client'

import { AlertTriangle, CheckCircle2, Loader2, RotateCw, ShieldAlert, Wrench, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  StructuredOutputIssue,
  StructuredOutputStatus,
} from '@/features/chat/types/chat'

interface StructuredOutputNoticeProps {
  status?: StructuredOutputStatus
  issues?: StructuredOutputIssue[]
  isStreaming: boolean
  onRepair?: (issue: StructuredOutputIssue) => void
  onRetry?: () => void
  onIgnore?: () => void
}

export function StructuredOutputNotice({
  status,
  issues = [],
  isStreaming,
  onRepair,
  onRetry,
  onIgnore,
}: StructuredOutputNoticeProps) {
  const visibleIssues = issues.slice(0, 3)
  const hasIssues = issues.length > 0

  if (!hasIssues && status !== 'repairing' && status !== 'repair_failed') {
    return null
  }

  const isRepairing = status === 'repairing'
  const isFailed = status === 'repair_failed'
  const title = isRepairing
    ? '正在局部修复结构化输出'
    : isFailed
      ? '局部修复失败'
      : isStreaming
        ? '检测到结构化块可能异常'
        : '结构化输出需要确认'

  const description = isStreaming
    ? '生成会继续进行，完成后可选择局部修复、整条重试或忽略。'
    : isFailed
      ? '可以再试一次局部修复，或改用整条重新生成。'
      : '发现媒体或数据块可能不是有效结构，建议先局部修复。'

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-xs',
        isFailed
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200'
      )}
    >
      <div className="flex items-start gap-2">
        {isRepairing ? (
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : isFailed ? (
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium">{title}</div>
          <div className="mt-0.5 text-muted-foreground">{description}</div>
          {visibleIssues.length > 0 && (
            <div className="mt-2 space-y-1">
              {visibleIssues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="line-clamp-2">
                    {getLanguageLabel(issue.language)}：{issue.reason}
                  </span>
                </div>
              ))}
              {issues.length > visibleIssues.length && (
                <div className="text-muted-foreground">
                  另有 {issues.length - visibleIssues.length} 个结构化块待确认
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isStreaming && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => visibleIssues[0] && onRepair?.(visibleIssues[0])}
            disabled={!visibleIssues[0] || isRepairing}
            className="h-7 px-2 text-xs"
          >
            {isRepairing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Wrench className="mr-1 h-3 w-3" />
            )}
            局部修复
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRetry}
            disabled={isRepairing}
            className="h-7 px-2 text-xs"
          >
            <RotateCw className="mr-1 h-3 w-3" />
            整条重试
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onIgnore}
            disabled={isRepairing}
            className="h-7 px-2 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            忽略
          </Button>
        </div>
      )}
    </div>
  )
}

function getLanguageLabel(language: StructuredOutputIssue['language']): string {
  if (language === 'image') return '图片块'
  if (language === 'chart') return '图表块'
  if (language === 'weather') return '天气块'
  return 'Markdown'
}
