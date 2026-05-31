import { useCallback, useRef, useState } from 'react'
import { ArrowUp, Brain, FileUp, Loader2, Mic, Paintbrush, Search, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MarkdownIcon } from '@/components/icons/MarkdownIcon'
import { TextFileIcon } from '@/components/icons/TextFileIcon'
import { getModelById } from '@/features/chat/constants/models'
import { cn } from '@/lib/utils'
import { KnowledgeSelector } from '@/features/knowledge/components/KnowledgeSelector'
import { ImageGenerationModal, type ImageConfig } from '../ImageGenerationModal'

interface ChatInputUIProps {
  input: string
  setInput: (value: string) => void
  selectedModel: string
  enableThinking: boolean
  enableWebSearch: boolean
  selectedKnowledgeBaseIds: string[]
  isLoading: boolean
  isRecording: boolean
  isTranscribing: boolean
  uploadedFiles: Array<{ name: string; size: number; type: 'txt' | 'md' }>
  onSubmit: (event: React.FormEvent) => void
  onStop: () => void
  _onModelChange?: (model: string) => void
  onThinkingToggle: (enabled: boolean) => void
  onWebSearchToggle: (enabled: boolean) => void
  onKnowledgeSelectionChange: (ids: string[]) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
  onImageGenerate?: (config: ImageConfig) => void
}

export function ChatInputUI({
  input,
  setInput,
  selectedModel,
  enableThinking,
  enableWebSearch,
  selectedKnowledgeBaseIds,
  isLoading,
  isRecording,
  isTranscribing,
  uploadedFiles,
  onSubmit,
  onStop,
  onThinkingToggle,
  onWebSearchToggle,
  onKnowledgeSelectionChange,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onFileUpload,
  onRemoveFile,
  onImageGenerate,
}: ChatInputUIProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const currentModel = getModelById(selectedModel)
  const disabled = isLoading || isRecording || isTranscribing
  const canSend = input.trim().length > 0 && !isRecording && !isTranscribing

  const handleImageGenerate = (config: ImageConfig) => {
    setShowImageModal(false)
    onImageGenerate?.(config)
  }

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)

    const file = event.dataTransfer.files[0]
    const inputElement = fileInputRef.current
    if (!file || !inputElement) return

    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    inputElement.files = dataTransfer.files
    inputElement.dispatchEvent(new Event('change', { bubbles: true }))
  }, [])

  const renderFileIcon = (type: 'txt' | 'md') => {
    if (type === 'md') {
      return <MarkdownIcon className="h-3.5 w-3.5 text-orange-500" />
    }
    return <TextFileIcon className="h-3.5 w-3.5 text-blue-500" />
  }

  return (
    <div
      className={cn(
        'relative shrink-0 bg-background transition-colors',
        isDragging && 'bg-blue-50 dark:bg-blue-900/10'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-50/90 backdrop-blur-sm pointer-events-none dark:bg-blue-900/20">
          <div className="text-center">
            <FileUp className="mx-auto mb-2 h-12 w-12 text-blue-500" />
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              将 .txt 或 .md 文件拖到这里
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-6 py-4">
        {isRecording && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
                  <div className="absolute h-12 w-12 animate-ping rounded-full bg-red-500/20" />
                  <Mic className="relative h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">正在录音...</p>
                  <p className="text-xs text-red-600 dark:text-red-400">停止后转写，也可以取消录音。</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onCancelRecording}>
                  <X className="mr-1 h-4 w-4" />
                  取消
                </Button>
                <Button type="button" size="sm" onClick={onStopRecording} className="bg-red-500 text-white hover:bg-red-600">
                  <Square className="mr-1 h-4 w-4 fill-current" />
                  停止
                </Button>
              </div>
            </div>
          </div>
        )}

        {isTranscribing && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">正在转写...</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">正在将语音转换为文字。</p>
              </div>
            </div>
          </div>
        )}

        <form
          id="chat-input-form"
          onSubmit={onSubmit}
          className="rounded-3xl bg-background p-3 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={isRecording ? '正在录音...' : isTranscribing ? '正在转写...' : '有问题尽管问...'}
            disabled={disabled}
            className="mb-2 h-12 w-full rounded-3xl bg-white px-5 text-[15px] text-[hsl(var(--text-primary))] outline-none placeholder:text-[hsl(var(--text-secondary))] dark:bg-gray-800"
            autoComplete="off"
          />

          {uploadedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm',
                    file.type === 'md'
                      ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
                      : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                  )}
                >
                  {renderFileIcon(file.type)}
                  <span className="max-w-[150px] truncate font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)}KB</span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(index)}
                    className="ml-1 text-muted-foreground transition-opacity hover:opacity-70"
                    aria-label={`移除 ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                onChange={onFileUpload}
                className="hidden"
              />

              <IconTip label="添加文件">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg hover:bg-[hsl(var(--input-hover))]"
                >
                  <FileUp className="h-4 w-4" />
                </Button>
              </IconTip>

              {currentModel?.supportsThinkingToggle && (
                <IconTip label={enableThinking ? '关闭深度思考' : '开启深度思考'}>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => onThinkingToggle(!enableThinking)}
                    disabled={disabled}
                    className={cn(
                      'h-8 w-8 rounded-lg transition-all',
                      enableThinking
                        ? 'bg-[hsl(var(--accent-thinking))] text-white hover:bg-[hsl(var(--accent-thinking))]/90'
                        : 'text-gray-600 hover:bg-[hsl(var(--input-hover))] dark:text-gray-400'
                    )}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                </IconTip>
              )}

              <KnowledgeSelector
                selectedIds={selectedKnowledgeBaseIds}
                onSelectionChange={onKnowledgeSelectionChange}
                disabled={disabled}
              />

              <IconTip label="生成图片">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowImageModal(true)}
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg hover:bg-[hsl(var(--input-hover))]"
                >
                  <Paintbrush className="h-4 w-4" />
                </Button>
              </IconTip>

              <IconTip label={enableWebSearch ? '关闭联网搜索' : '开启联网搜索'}>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onWebSearchToggle(!enableWebSearch)}
                  disabled={disabled}
                  className={cn(
                    'h-8 w-8 rounded-lg transition-all',
                    enableWebSearch
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'text-gray-600 hover:bg-[hsl(var(--input-hover))] dark:text-gray-400'
                  )}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </IconTip>
            </div>

            <div className="flex items-center gap-1">
              {!isLoading && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={isRecording ? onStopRecording : onStartRecording}
                  disabled={isTranscribing}
                  className={cn(
                    'h-8 w-8 rounded-lg',
                    isRecording
                      ? 'bg-[hsl(var(--accent-red))]/10 text-[hsl(var(--accent-red))]'
                      : 'hover:bg-[hsl(var(--input-hover))]'
                  )}
                  aria-label={isRecording ? '停止录音' : '开始录音'}
                >
                  {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}

              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  onClick={onStop}
                  className="h-8 w-8 rounded-full bg-[hsl(var(--button-primary-bg))] text-white hover:bg-[hsl(var(--button-primary-hover))]"
                  aria-label="停止生成"
                >
                  <Square className="h-3.5 w-3.5" fill="currentColor" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSend}
                  className={cn(
                    'h-8 w-8 rounded-full transition-colors',
                    canSend
                      ? 'bg-[hsl(var(--button-primary-bg))] text-white hover:bg-[hsl(var(--button-primary-hover))]'
                      : 'cursor-not-allowed bg-[hsl(var(--text-tertiary))]/20 text-[hsl(var(--text-tertiary))]'
                  )}
                  aria-label="发送消息"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </form>

        <p className="mt-3 text-center text-xs text-[hsl(var(--text-secondary))]">
          MAGIC 也可能出错。重要信息请核实。
        </p>
      </div>

      <ImageGenerationModal
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onGenerate={handleImageGenerate}
      />
    </div>
  )
}

function IconTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
