import { prisma } from '@/server/db/client'
import { MessageRepository } from '@/server/repositories/message.repository'
import {
  BM25_WEIGHT,
  DEFAULT_RAG_LIMIT,
  MAX_RAG_CONTEXT_CHARS,
  RERANK_WEIGHT,
  VECTOR_WEIGHT,
  type RagContext,
  type RagSource,
  type RetrievalOptions,
} from './types'
import { createEmbedding, DEFAULT_RERANK_MODEL, rerankDocuments } from './embeddings'

interface CandidateRow {
  chunkId: string
  documentId: string
  knowledgeBaseId: string
  fileName: string
  chunkIndex: number
  heading: string | null
  content: string
  score: number
}

interface TextCandidateRow {
  chunkId: string
  documentId: string
  knowledgeBaseId: string
  fileName: string
  chunkIndex: number
  heading: string | null
  content: string
}

type CandidateMapValue = Omit<RagSource, 'rerankScore' | 'finalScore'> & {
  vectorRank?: number
  bm25Rank?: number
}

export async function retrieveKnowledgeContext(options: RetrievalOptions): Promise<RagContext | null> {
  const query = options.query.trim()
  if (!query) return null

  const limit = clamp(options.limit ?? DEFAULT_RAG_LIMIT, 1, 12)
  const maxContextChars = options.maxContextChars ?? MAX_RAG_CONTEXT_CHARS
  const queryEmbedding = await createEmbedding(query)

  const [vectorRows, textRows] = await Promise.all([
    searchVector({
      userId: options.userId,
      queryEmbedding,
      knowledgeBaseIds: options.knowledgeBaseIds,
      limit: Math.max(limit * 4, 20),
    }),
    loadBm25Corpus({
      userId: options.userId,
      knowledgeBaseIds: options.knowledgeBaseIds,
    }),
  ])
  const bm25Rows = searchBm25(query, textRows, Math.max(limit * 4, 20))

  const candidates = mergeCandidates(vectorRows, bm25Rows)
  if (candidates.length === 0) return null

  const rerankScores = await rerankDocuments(
    query,
    candidates.map((candidate) => candidate.content)
  )

  const scored = candidates
    .map((candidate, index): RagSource => {
      const rerankScore = rerankScores?.[index] ?? null
      const finalScore =
        candidate.vectorScore * VECTOR_WEIGHT +
        candidate.bm25Score * BM25_WEIGHT +
        (rerankScore ?? 0) * RERANK_WEIGHT

      return {
        chunkId: candidate.chunkId,
        documentId: candidate.documentId,
        knowledgeBaseId: candidate.knowledgeBaseId,
        fileName: candidate.fileName,
        chunkIndex: candidate.chunkIndex,
        heading: candidate.heading,
        content: candidate.content,
        vectorScore: candidate.vectorScore,
        bm25Score: candidate.bm25Score,
        rerankScore,
        finalScore,
      }
    })
    .sort((a, b) => b.finalScore - a.finalScore)

  const selected = compressSourcesToBudget(scored, limit, maxContextChars)
  if (selected.length === 0) return null

  return {
    sources: selected,
    contextText: formatRagContext(selected),
    search: {
      query,
      vectorCandidates: vectorRows.length,
      bm25Candidates: bm25Rows.length,
      bm25CorpusSize: textRows.length,
      returned: selected.length,
      rerankModel: rerankScores ? DEFAULT_RERANK_MODEL : undefined,
    },
  }
}

export async function buildSlidingWindowMessages(conversationId: string, maxMessages = 20) {
  return MessageRepository.findByConversationId(conversationId, maxMessages)
}

function mergeCandidates(vectorRows: CandidateRow[], bm25Rows: CandidateRow[]): CandidateMapValue[] {
  const map = new Map<string, CandidateMapValue>()

  vectorRows.forEach((row, index) => {
    map.set(row.chunkId, {
      chunkId: row.chunkId,
      documentId: row.documentId,
      knowledgeBaseId: row.knowledgeBaseId,
      fileName: row.fileName,
      chunkIndex: row.chunkIndex,
      heading: row.heading,
      content: row.content,
      vectorScore: normalizeRankScore(index, vectorRows.length, row.score),
      bm25Score: 0,
      vectorRank: index + 1,
    })
  })

  bm25Rows.forEach((row, index) => {
    const existing = map.get(row.chunkId)
    const bm25Score = normalizeRankScore(index, bm25Rows.length, row.score)
    if (existing) {
      existing.bm25Score = bm25Score
      existing.bm25Rank = index + 1
      return
    }

    map.set(row.chunkId, {
      chunkId: row.chunkId,
      documentId: row.documentId,
      knowledgeBaseId: row.knowledgeBaseId,
      fileName: row.fileName,
      chunkIndex: row.chunkIndex,
      heading: row.heading,
      content: row.content,
      vectorScore: 0,
      bm25Score,
      bm25Rank: index + 1,
    })
  })

  return Array.from(map.values())
}

function normalizeRankScore(index: number, total: number, rawScore: number): number {
  if (total <= 1) return Math.max(rawScore, 1)
  const rankScore = 1 - index / total
  return Math.max(0, Math.min(1, Math.max(rankScore, rawScore || 0)))
}

function compressSourcesToBudget(sources: RagSource[], limit: number, maxChars: number): RagSource[] {
  const selected: RagSource[] = []
  let used = 0

  for (const source of sources) {
    if (selected.length >= limit) break
    const reserve = 220
    const available = maxChars - used - reserve
    if (available <= 0) break

    const content = source.content.length > available
      ? `${source.content.slice(0, Math.max(available - 20, 0)).trim()}...`
      : source.content

    selected.push({ ...source, content })
    used += content.length + reserve
  }

  return selected
}

function formatRagContext(sources: RagSource[]): string {
  return sources
    .map((source, index) => {
      const title = source.heading
        ? `${source.fileName} / ${source.heading}`
        : source.fileName
      return [
        `[${index + 1}] ${title}`,
        `chunk=${source.chunkIndex}; score=${source.finalScore.toFixed(3)}; vector=${source.vectorScore.toFixed(3)}; bm25=${source.bm25Score.toFixed(3)}; rerank=${source.rerankScore?.toFixed(3) ?? 'n/a'}`,
        source.content,
      ].join('\n')
    })
    .join('\n\n---\n\n')
}

async function searchVector(input: {
  userId: string
  queryEmbedding: number[]
  knowledgeBaseIds?: string[]
  limit: number
}): Promise<CandidateRow[]> {
  const knowledgeBaseIds = input.knowledgeBaseIds?.filter(Boolean) || []

  if (knowledgeBaseIds.length > 0) {
    return prisma.$queryRaw<CandidateRow[]>`
      SELECT
        kc."id" AS "chunkId",
        kc."documentId",
        kc."knowledgeBaseId",
        kd."fileName",
        kc."chunkIndex",
        kc."heading",
        kc."content",
        GREATEST(0, 1 - (kc."embedding" <=> ${JSON.stringify(input.queryEmbedding)}::vector))::float AS "score"
      FROM "KnowledgeChunk" kc
      JOIN "KnowledgeDocument" kd ON kd."id" = kc."documentId"
      WHERE kc."userId" = ${input.userId}
        AND kc."knowledgeBaseId" = ANY(${knowledgeBaseIds})
        AND kc."embedding" IS NOT NULL
      ORDER BY kc."embedding" <=> ${JSON.stringify(input.queryEmbedding)}::vector
      LIMIT ${input.limit}
    `
  }

  return prisma.$queryRaw<CandidateRow[]>`
    SELECT
      kc."id" AS "chunkId",
      kc."documentId",
      kc."knowledgeBaseId",
      kd."fileName",
      kc."chunkIndex",
      kc."heading",
      kc."content",
      GREATEST(0, 1 - (kc."embedding" <=> ${JSON.stringify(input.queryEmbedding)}::vector))::float AS "score"
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kd."id" = kc."documentId"
    WHERE kc."userId" = ${input.userId}
      AND kc."embedding" IS NOT NULL
    ORDER BY kc."embedding" <=> ${JSON.stringify(input.queryEmbedding)}::vector
    LIMIT ${input.limit}
  `
}

async function loadBm25Corpus(input: {
  userId: string
  knowledgeBaseIds?: string[]
}): Promise<TextCandidateRow[]> {
  const knowledgeBaseIds = input.knowledgeBaseIds?.filter(Boolean) || []

  if (knowledgeBaseIds.length > 0) {
    return prisma.$queryRaw<TextCandidateRow[]>`
      SELECT
        kc."id" AS "chunkId",
        kc."documentId",
        kc."knowledgeBaseId",
        kd."fileName",
        kc."chunkIndex",
        kc."heading",
        kc."content"
      FROM "KnowledgeChunk" kc
      JOIN "KnowledgeDocument" kd ON kd."id" = kc."documentId"
      WHERE kc."userId" = ${input.userId}
        AND kc."knowledgeBaseId" = ANY(${knowledgeBaseIds})
      ORDER BY kd."createdAt" DESC, kc."chunkIndex" ASC
      LIMIT 1000
    `
  }

  return prisma.$queryRaw<TextCandidateRow[]>`
    SELECT
      kc."id" AS "chunkId",
      kc."documentId",
      kc."knowledgeBaseId",
      kd."fileName",
      kc."chunkIndex",
      kc."heading",
      kc."content"
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kd."id" = kc."documentId"
    WHERE kc."userId" = ${input.userId}
    ORDER BY kd."createdAt" DESC, kc."chunkIndex" ASC
    LIMIT 1000
  `
}

function searchBm25(query: string, rows: TextCandidateRow[], limit: number): CandidateRow[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0 || rows.length === 0) return []

  const documents = rows.map((row) => {
    const terms = tokenize(row.content)
    const frequencies = new Map<string, number>()
    for (const term of terms) {
      frequencies.set(term, (frequencies.get(term) || 0) + 1)
    }
    return {
      row,
      frequencies,
      length: terms.length || 1,
    }
  })

  const avgDocLength = documents.reduce((sum, document) => sum + document.length, 0) / documents.length
  const documentFrequency = new Map<string, number>()
  const uniqueQueryTerms = Array.from(new Set(queryTerms))

  for (const term of uniqueQueryTerms) {
    let count = 0
    for (const document of documents) {
      if (document.frequencies.has(term)) count += 1
    }
    documentFrequency.set(term, count)
  }

  const k1 = 1.5
  const b = 0.75

  return documents
    .map((document) => {
      let score = 0
      for (const term of uniqueQueryTerms) {
        const frequency = document.frequencies.get(term) || 0
        if (frequency === 0) continue

        const df = documentFrequency.get(term) || 0
        const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5))
        const denominator = frequency + k1 * (1 - b + b * (document.length / avgDocLength))
        score += idf * ((frequency * (k1 + 1)) / denominator)
      }

      return {
        ...document.row,
        score,
      }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase()
  const latin = normalized.match(/[a-z0-9_./-]+/g) || []
  const cjk = normalized.match(/[\u4e00-\u9fff]{1,2}/g) || []
  return [...latin, ...cjk].filter((term) => term.length > 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
