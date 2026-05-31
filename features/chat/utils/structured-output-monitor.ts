import {
  detectStructuredOutputIssues,
  getIgnoredStructuredIssueIds,
} from './structured-output-detector'
import type { StructuredOutputIssue } from '@/features/chat/types/chat'

interface StructuredOutputMonitorOptions {
  messageId: string
  onIssues: (issues: StructuredOutputIssue[], final: boolean) => void
}

type IdleCallbackHandle = number

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => IdleCallbackHandle
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void
}

export class StructuredOutputMonitor {
  private readonly messageId: string
  private readonly onIssues: (issues: StructuredOutputIssue[], final: boolean) => void
  private readonly trustedImageUrls = new Set<string>()
  private content = ''
  private idleHandle: IdleCallbackHandle | null = null
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(options: StructuredOutputMonitorOptions) {
    this.messageId = options.messageId
    this.onIssues = options.onIssues
  }

  append(delta: string): void {
    if (this.destroyed) return
    this.content += delta
    this.scheduleAnalysis()
  }

  trustImageUrl(url: string): void {
    if (!url) return
    this.trustedImageUrls.add(url)
    this.scheduleAnalysis()
  }

  finalize(content?: string): StructuredOutputIssue[] {
    if (this.destroyed) return []
    if (content !== undefined) this.content = content

    this.cancelScheduledAnalysis()
    return this.analyze(true)
  }

  destroy(): void {
    this.destroyed = true
    this.cancelScheduledAnalysis()
    this.content = ''
    this.trustedImageUrls.clear()
  }

  private scheduleAnalysis(): void {
    if (this.destroyed || this.idleHandle !== null || this.timeoutHandle !== null) return

    const win = typeof window === 'undefined' ? null : (window as WindowWithIdleCallback)
    if (win?.requestIdleCallback) {
      this.idleHandle = win.requestIdleCallback(() => {
        this.idleHandle = null
        this.analyze(false)
      }, { timeout: 250 })
      return
    }

    this.timeoutHandle = setTimeout(() => {
      this.timeoutHandle = null
      this.analyze(false)
    }, 250)
  }

  private cancelScheduledAnalysis(): void {
    const win = typeof window === 'undefined' ? null : (window as WindowWithIdleCallback)

    if (this.idleHandle !== null) {
      win?.cancelIdleCallback?.(this.idleHandle)
      this.idleHandle = null
    }

    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  private analyze(final: boolean): StructuredOutputIssue[] {
    if (this.destroyed) return []

    const ignoredIds = getIgnoredStructuredIssueIds(this.messageId)
    const issues = detectStructuredOutputIssues(this.content, {
      trustedImageUrls: this.trustedImageUrls,
      final,
    }).filter((issue) => !ignoredIds.has(issue.id))

    this.onIssues(issues, final)
    return issues
  }
}
