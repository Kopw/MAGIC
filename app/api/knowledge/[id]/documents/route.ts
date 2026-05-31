import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { KnowledgeRepository } from '@/server/repositories/knowledge.repository'
import { ingestKnowledgeDocument } from '@/server/services/rag/ingestion.service'

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024
const VALID_TYPES = new Set(['text/plain', 'text/markdown', ''])
const VALID_EXTENSIONS = ['.txt', '.md']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const base = await KnowledgeRepository.findBase(userId, id)

    if (!base) {
      return NextResponse.json({ error: '未找到知识库' }, { status: 404 })
    }

    const documents = await KnowledgeRepository.listDocuments(userId, id)
    return NextResponse.json({ documents })
  } catch (error) {
    return handleKnowledgeError(error)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 })
    }

    const hasValidExtension = VALID_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!VALID_TYPES.has(file.type) && !hasValidExtension) {
      return NextResponse.json({ error: '仅支持 .txt 和 .md 文件' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: '文件过大，最大支持 2MB' }, { status: 400 })
    }

    const rawText = await file.text()
    const document = await ingestKnowledgeDocument({
      userId,
      knowledgeBaseId: id,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      rawText,
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    return handleKnowledgeError(error)
  }
}

function handleKnowledgeError(error: unknown) {
  const message = error instanceof Error ? error.message : '服务器内部错误'
  const status = message === 'Unauthorized'
    ? 401
    : message.includes('not found') || message.includes('未找到')
      ? 404
      : message.includes('too large') || message.includes('empty') || message.includes('过大') || message.includes('为空')
        ? 400
        : 500

  console.error('[KnowledgeDocumentsAPI]', message)
  return NextResponse.json({ error: message === 'Unauthorized' ? '请先登录' : message }, { status })
}
