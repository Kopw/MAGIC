const SILICONFLOW_BASE_URL = 'https://api.siliconflow.com/v1'

export const DEFAULT_EMBEDDING_MODEL =
  process.env.RAG_EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-0.6B'
export const DEFAULT_RERANK_MODEL =
  process.env.RAG_RERANK_MODEL || 'Qwen/Qwen3-Reranker-0.6B'
export const EMBEDDING_DIMENSION = Number(process.env.RAG_EMBEDDING_DIMENSION || 1024)

interface EmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
}

interface RerankResponse {
  results?: Array<{
    index: number
    relevance_score?: number
    score?: number
  }>
}

export async function createEmbedding(input: string, apiKey?: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([input], apiKey)
  return embedding
}

export async function createEmbeddings(inputs: string[], apiKey?: string): Promise<number[][]> {
  if (inputs.length === 0) return []

  const key = resolveApiKey(apiKey)
  const response = await fetch(`${SILICONFLOW_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
      input: inputs,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`生成文档向量失败：${response.status} - ${detail}`)
  }

  const payload = (await response.json()) as EmbeddingResponse
  const sorted = [...payload.data].sort((a, b) => a.index - b.index)
  const embeddings = sorted.map((item) => normalizeDimension(item.embedding))

  if (embeddings.length !== inputs.length) {
    throw new Error(`向量接口返回数量异常：预期 ${inputs.length} 个，实际 ${embeddings.length} 个`)
  }

  return embeddings
}

export async function rerankDocuments(
  query: string,
  documents: string[],
  apiKey?: string
): Promise<number[] | null> {
  if (documents.length === 0) return []

  const key = apiKey || process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY
  if (!key) return null

  try {
    const response = await fetch(`${SILICONFLOW_BASE_URL}/rerank`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_RERANK_MODEL,
        query,
        documents,
        top_n: documents.length,
        return_documents: false,
      }),
    })

    if (!response.ok) {
      console.warn('[RAG] Rerank skipped:', response.status, await response.text())
      return null
    }

    const payload = (await response.json()) as RerankResponse
    const scores = new Array(documents.length).fill(0)

    for (const item of payload.results || []) {
      scores[item.index] = item.relevance_score ?? item.score ?? 0
    }

    return scores
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知重排序错误'
    console.warn('[RAG] Rerank skipped:', message)
    return null
  }
}

function resolveApiKey(apiKey?: string): string {
  const key = apiKey || process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error('未配置向量模型 API Key')
  }
  return key
}

function normalizeDimension(vector: number[]): number[] {
  if (vector.length === EMBEDDING_DIMENSION) return vector

  if (vector.length > EMBEDDING_DIMENSION) {
    return vector.slice(0, EMBEDDING_DIMENSION)
  }

  return [...vector, ...new Array(EMBEDDING_DIMENSION - vector.length).fill(0)]
}
