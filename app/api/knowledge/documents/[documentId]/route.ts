import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { KnowledgeRepository } from '@/server/repositories/knowledge.repository'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { documentId } = await params
    const success = await KnowledgeRepository.deleteDocument(userId, documentId)

    if (!success) {
      return NextResponse.json({ error: '未找到文档' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器内部错误'
    const status = message === 'Unauthorized' ? 401 : 500
    console.error('[KnowledgeDocumentAPI]', message)
    return NextResponse.json({ error: message === 'Unauthorized' ? '请先登录' : message }, { status })
  }
}
