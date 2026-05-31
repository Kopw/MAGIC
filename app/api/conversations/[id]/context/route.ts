import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { ConversationRepository } from '@/server/repositories/conversation.repository'
import { UserRepository } from '@/server/repositories/user.repository'
import { audit } from '@/server/middleware/audit'
import { compressConversationContext, getConversationContextUsage } from '@/server/services/chat/context-manager'

const DEFAULT_CONTEXT_MODEL = 'Qwen/Qwen2.5-7B-Instruct'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const conversation = await ConversationRepository.findById(id, userId)

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const contextUsage = await getConversationContextUsage({ conversation })

    await audit({
      userId,
      action: 'conversation.view',
      resourceId: id,
      request: req,
    })

    return NextResponse.json({ contextUsage })
  } catch (error) {
    console.error('Get conversation context error:', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const conversation = await ConversationRepository.findById(id, userId)

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const user = await UserRepository.findById(userId)
    const apiKey = user?.apiKey || process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key not configured. Please set your SiliconFlow API Key in your profile or contact administrator.' },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const result = await compressConversationContext({
      conversation,
      apiKey,
      model: typeof body.model === 'string' && body.model ? body.model : DEFAULT_CONTEXT_MODEL,
    })

    await audit({
      userId,
      action: 'conversation.update',
      resourceId: id,
      metadata: {
        operation: 'context.compress',
        compressed: result.compressed,
        summarizedMessages: result.summarizedMessages,
      },
      request: req,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Compress conversation context error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
