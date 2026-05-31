'use client'

import { useEffect, useMemo } from 'react'
import { BookOpen, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'

interface KnowledgeSelectorProps {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  disabled?: boolean
}

export function KnowledgeSelector({ selectedIds, onSelectionChange, disabled }: KnowledgeSelectorProps) {
  const knowledgeBases = useKnowledgeStore((state) => state.knowledgeBases)
  const isLoading = useKnowledgeStore((state) => state.isLoading)
  const loadKnowledgeBases = useKnowledgeStore((state) => state.loadKnowledgeBases)

  useEffect(() => {
    loadKnowledgeBases().catch((error) => {
      console.error('[KnowledgeSelector] 加载知识库失败:', error)
    })
  }, [loadKnowledgeBases])

  const selectedCount = selectedIds.length
  const selectedNames = useMemo(() => {
    const selected = knowledgeBases.filter((base) => selectedIds.includes(base.id))
    return selected.map((base) => base.name).join(', ')
  }, [knowledgeBases, selectedIds])

  const toggleId = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id]
    onSelectionChange(next)
  }

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                className={cn(
                  'h-8 w-8 rounded-lg transition-all relative',
                  selectedCount > 0
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'hover:bg-[hsl(var(--input-hover))] text-gray-600 dark:text-gray-400'
                )}
              >
                <BookOpen className="h-4 w-4" />
                {selectedCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-background px-1 text-[10px] font-medium text-emerald-600 shadow-sm">
                    {selectedCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{selectedCount > 0 ? `知识库: ${selectedNames}` : '选择知识库'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>知识库检索</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">加载中...</div>
        ) : knowledgeBases.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            还没有知识库，先在知识库页面上传文档
          </div>
        ) : (
          knowledgeBases.map((base) => (
            <DropdownMenuCheckboxItem
              key={base.id}
              checked={selectedIds.includes(base.id)}
              onCheckedChange={() => toggleId(base.id)}
              onSelect={(event) => event.preventDefault()}
              className="items-start"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{base.name}</span>
                <span className="text-xs text-muted-foreground">
                  {base._count?.documents ?? 0} 个文档 · {base._count?.chunks ?? 0} 个切片
                </span>
              </div>
              {selectedIds.includes(base.id) && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
