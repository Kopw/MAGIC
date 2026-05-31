/**
 * Message API - 更新消息内容
 *
 * PATCH /api/message/[messageId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/server/auth/utils'
import { MessageRepository } from '@/server/repositories/message.repository'
import { ConversationRepository } from '@/server/repositories/conversation.repository'

interface PatchRequest {
  content?: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
): Promise<NextResponse> {
  try {
    const userId = await getCurrentUserId()
    const { messageId } = await params
    const body = (await request.json()) as PatchRequest

    if (!body.content) {
      return NextResponse.json(
        { error: '缺少 content 参数' },
        { status: 400 }
      )
    }

    const message = await MessageRepository.findById(messageId)
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const conversation = await ConversationRepository.findById(message.conversationId, userId)
    if (!conversation) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await MessageRepository.update(messageId, {
      content: body.content,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('[Message PATCH] Error:', error)
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    )
  }
}
