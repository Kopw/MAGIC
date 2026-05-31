import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { KnowledgeRepository } from '@/server/repositories/knowledge.repository'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const body = await req.json()
    const name = body.name == null ? undefined : String(body.name).trim()
    const description = body.description == null ? undefined : String(body.description).trim()

    if (name !== undefined && !name) {
      return NextResponse.json({ error: '请输入知识库名称' }, { status: 400 })
    }

    const success = await KnowledgeRepository.updateBase(userId, id, { name, description })
    if (!success) {
      return NextResponse.json({ error: '未找到知识库' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleKnowledgeError(error)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const success = await KnowledgeRepository.deleteBase(userId, id)

    if (!success) {
      return NextResponse.json({ error: '未找到知识库' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleKnowledgeError(error)
  }
}

function handleKnowledgeError(error: unknown) {
  const message = error instanceof Error ? error.message : '服务器内部错误'
  const status = message === 'Unauthorized' ? 401 : 500
  console.error('[KnowledgeAPI]', message)
  return NextResponse.json({ error: message === 'Unauthorized' ? '请先登录' : message }, { status })
}
