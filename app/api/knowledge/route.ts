import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { KnowledgeRepository } from '@/server/repositories/knowledge.repository'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const knowledgeBases = await KnowledgeRepository.listBases(userId)
    return NextResponse.json({ knowledgeBases })
  } catch (error) {
    return handleKnowledgeError(error)
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId()
    const body = await req.json()
    const name = String(body.name || '').trim()
    const description = body.description ? String(body.description).trim() : undefined

    if (!name) {
      return NextResponse.json({ error: '请输入知识库名称' }, { status: 400 })
    }

    const knowledgeBase = await KnowledgeRepository.createBase(userId, name, description)
    return NextResponse.json({ knowledgeBase }, { status: 201 })
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
