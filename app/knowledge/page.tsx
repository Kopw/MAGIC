'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { KnowledgeAPI, type KnowledgeDocumentSummary } from '@/features/knowledge/services/knowledge-api'
import { useKnowledgeStore } from '@/features/knowledge/store/knowledge.store'
import { cn } from '@/lib/utils'

function getDocumentStatusLabel(status: string) {
  switch (status) {
    case 'ready':
      return '已就绪'
    case 'processing':
      return '处理中'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

function KnowledgePageContent() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const knowledgeBases = useKnowledgeStore((state) => state.knowledgeBases)
  const isLoading = useKnowledgeStore((state) => state.isLoading)
  const loadKnowledgeBases = useKnowledgeStore((state) => state.loadKnowledgeBases)
  const createKnowledgeBase = useKnowledgeStore((state) => state.createKnowledgeBase)
  const deleteKnowledgeBase = useKnowledgeStore((state) => state.deleteKnowledgeBase)

  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newBaseName, setNewBaseName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedBase = knowledgeBases.find((base) => base.id === selectedBaseId) || knowledgeBases[0]

  useEffect(() => {
    loadKnowledgeBases().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : '加载知识库失败')
    })
  }, [loadKnowledgeBases])

  useEffect(() => {
    if (!selectedBaseId && knowledgeBases[0]) {
      setSelectedBaseId(knowledgeBases[0].id)
    }
  }, [knowledgeBases, selectedBaseId])

  useEffect(() => {
    if (!selectedBase?.id) {
      setDocuments([])
      return
    }

    setDocumentsLoading(true)
    KnowledgeAPI.listDocuments(selectedBase.id)
      .then(({ documents }) => setDocuments(documents))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : '加载文档失败')
      })
      .finally(() => setDocumentsLoading(false))
  }, [selectedBase?.id])

  const handleCreateBase = async () => {
    const name = newBaseName.trim()
    if (!name) return

    try {
      setError(null)
      const id = await createKnowledgeBase(name)
      setSelectedBaseId(id)
      setNewBaseName('')
      setIsCreateOpen(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建知识库失败')
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedBase?.id) return

    try {
      setUploading(true)
      setError(null)
      await KnowledgeAPI.uploadDocument(selectedBase.id, file)
      const [{ documents }] = await Promise.all([
        KnowledgeAPI.listDocuments(selectedBase.id),
        loadKnowledgeBases(),
      ])
      setDocuments(documents)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传文档失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedBase?.id) return
    await KnowledgeAPI.removeDocument(documentId)
    const [{ documents }] = await Promise.all([
      KnowledgeAPI.listDocuments(selectedBase.id),
      loadKnowledgeBases(),
    ])
    setDocuments(documents)
  }

  const handleDeleteBase = async (id: string) => {
    await deleteKnowledgeBase(id)
    setSelectedBaseId(null)
    setDocuments([])
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-[hsl(var(--sidebar-bg))]">
        <div className="flex h-[60px] items-center justify-between px-4">
          <Link href="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            返回聊天
          </Link>
          <Button size="icon" variant="ghost" onClick={() => setIsCreateOpen(true)} aria-label="新建知识库">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 pb-4">
          <div className="space-y-1">
            {isLoading ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载...
              </div>
            ) : knowledgeBases.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">还没有知识库</div>
            ) : (
              knowledgeBases.map((base) => (
                <button
                  key={base.id}
                  type="button"
                  onClick={() => setSelectedBaseId(base.id)}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-left transition-colors',
                    selectedBase?.id === base.id
                      ? 'bg-background shadow-sm'
                      : 'hover:bg-[hsl(var(--sidebar-hover))]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{base.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {base._count?.documents ?? 0} 个文档 · {base._count?.chunks ?? 0} 个切片
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold">{selectedBase?.name || '知识库'}</h1>
            <p className="text-sm text-muted-foreground">
              文档会被切片、向量化，并在聊天时作为参考资料检索。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedBase && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteBase(selectedBase.id).catch(console.error)}
                className="text-muted-foreground hover:text-red-600"
                aria-label="删除知识库"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedBase || uploading}
              className="gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              上传文档
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {!selectedBase ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              先创建一个知识库，再上传文档。
            </div>
          ) : documentsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载文档...
            </div>
          ) : documents.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-10 w-10" />
                <p className="text-sm">上传 .txt 或 .md 文件来建立索引。</p>
              </div>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {documents.map((document) => (
                <div key={document.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{document.fileName}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={document.status === 'ready' ? 'default' : 'secondary'}>
                        {getDocumentStatusLabel(document.status)}
                      </Badge>
                      <span>{document.chunkCount} 个切片</span>
                      {document.size ? <span>{(document.size / 1024).toFixed(1)} KB</span> : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteDocument(document.id).catch(console.error)}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="删除文档"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
            <DialogDescription>
              用知识库归档文档，并在聊天时检索相关内容。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newBaseName}
            onChange={(event) => setNewBaseName(event.target.value)}
            placeholder="例如：MAGIC 项目文档"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateBase} disabled={!newBaseName.trim()}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function KnowledgePage() {
  return (
    <AuthGuard redirectTo="/">
      <KnowledgePageContent />
    </AuthGuard>
  )
}
