export interface KnowledgeBaseSummary {
  id: string
  name: string
  description?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    documents: number
    chunks: number
  }
}

export interface KnowledgeDocumentSummary {
  id: string
  knowledgeBaseId: string
  fileName: string
  mimeType?: string | null
  size?: number | null
  status: string
  errorMessage?: string | null
  chunkCount: number
  createdAt: string
  updatedAt: string
}

export const KnowledgeAPI = {
  async list(): Promise<{ knowledgeBases: KnowledgeBaseSummary[] }> {
    const response = await fetch('/api/knowledge')
    if (!response.ok) throw new Error('加载知识库失败')
    return response.json()
  },

  async create(name: string, description?: string): Promise<{ knowledgeBase: KnowledgeBaseSummary }> {
    const response = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!response.ok) throw new Error('创建知识库失败')
    return response.json()
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('删除知识库失败')
  },

  async listDocuments(id: string): Promise<{ documents: KnowledgeDocumentSummary[] }> {
    const response = await fetch(`/api/knowledge/${id}/documents`)
    if (!response.ok) throw new Error('加载文档失败')
    return response.json()
  },

  async uploadDocument(id: string, file: File): Promise<{ document: KnowledgeDocumentSummary }> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`/api/knowledge/${id}/documents`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      throw new Error(detail?.error || '上传文档失败')
    }
    return response.json()
  },

  async removeDocument(documentId: string): Promise<void> {
    const response = await fetch(`/api/knowledge/documents/${documentId}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('删除文档失败')
  },
}
