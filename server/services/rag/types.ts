export const DEFAULT_RAG_LIMIT = 6
export const MAX_RAG_CONTEXT_CHARS = 9000
export const VECTOR_WEIGHT = 0.55
export const BM25_WEIGHT = 0.25
export const RERANK_WEIGHT = 0.2

export type KnowledgeDocumentStatus = 'processing' | 'ready' | 'failed'

export interface ChunkInput {
  content: string
  chunkIndex: number
  heading?: string
  tokenCount: number
  metadata: {
    startOffset: number
    endOffset: number
    source: 'markdown-heading' | 'paragraph-window' | 'sliding-window'
  }
}

export interface RagSource {
  chunkId: string
  documentId: string
  knowledgeBaseId: string
  fileName: string
  chunkIndex: number
  heading?: string | null
  content: string
  vectorScore: number
  bm25Score: number
  rerankScore: number | null
  finalScore: number
}

export interface RagContext {
  sources: RagSource[]
  contextText: string
  search: {
    query: string
    rewrittenQuery?: string
    vectorCandidates: number
    bm25Candidates: number
    bm25CorpusSize?: number
    returned: number
    rerankModel?: string
  }
}

export interface RetrievalOptions {
  userId: string
  query: string
  knowledgeBaseIds?: string[]
  limit?: number
  maxContextChars?: number
}

export interface IngestDocumentInput {
  userId: string
  knowledgeBaseId: string
  fileName: string
  mimeType?: string
  size?: number
  rawText: string
}
