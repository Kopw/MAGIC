import { createHash } from 'crypto'
import { KnowledgeRepository } from '@/server/repositories/knowledge.repository'
import { chunkDocument } from './chunker'
import { createEmbeddings } from './embeddings'
import type { IngestDocumentInput } from './types'

const MAX_DOCUMENT_CHARS = 400_000
const EMBEDDING_BATCH_SIZE = 16

export async function ingestKnowledgeDocument(input: IngestDocumentInput) {
  const base = await KnowledgeRepository.findBase(input.userId, input.knowledgeBaseId)
  if (!base) {
    throw new Error('未找到知识库')
  }

  const rawText = input.rawText.trim()
  if (!rawText) {
    throw new Error('文档内容为空')
  }

  if (rawText.length > MAX_DOCUMENT_CHARS) {
    throw new Error('文档内容过大，无法建立索引')
  }

  const chunks = chunkDocument(rawText)
  if (chunks.length === 0) {
    throw new Error('无法从文档中生成切片')
  }

  const embeddings: number[][] = []
  for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE)
    const batchEmbeddings = await createEmbeddings(batch.map((chunk) => chunk.content))
    embeddings.push(...batchEmbeddings)
  }

  const contentHash = createHash('sha256')
    .update(input.knowledgeBaseId)
    .update(input.fileName)
    .update(rawText)
    .digest('hex')

  return KnowledgeRepository.createDocumentWithChunks({
    userId: input.userId,
    knowledgeBaseId: input.knowledgeBaseId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    size: input.size,
    contentHash,
    rawText,
    chunks: chunks.map((chunk, index) => ({
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      heading: chunk.heading,
      tokenCount: chunk.tokenCount,
      metadata: chunk.metadata,
      embedding: embeddings[index],
    })),
  })
}
