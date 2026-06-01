/**
 * Chat API Route
 * 
 * 路由层：只负责请求校验和响应格式
 * 业务逻辑委托给 ChatService
 */

import { getCurrentUserId } from '@/server/auth/utils'
import { UserRepository } from '@/server/repositories/user.repository'
import { handleChatRequest, NotFoundError } from '@/server/services/chat'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0, no-transform',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Surrogate-Control': 'no-store',
  Pragma: 'no-cache',
  Expires: '0',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
  'X-Content-Type-Options': 'nosniff',
} as const

export async function POST(req: Request) {
  // 1. 认证校验
  let userId: string
  try {
    userId = await getCurrentUserId()
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 获取用户和 API Key
  const user = await UserRepository.findById(userId)
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 })
  }

  const apiKey = user.apiKey || process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'API Key not configured. Please set your SiliconFlow API Key in your profile or contact administrator.' },
      { status: 400 }
    )
  }

  // 3. 解析请求体
  const body = await req.json()
  if (!body.content?.trim()) {
    return Response.json({ error: 'Message is required' }, { status: 400 })
  }

  // 4. 调用 ChatService 处理
  try {
    const { stream, sessionId, conversationId, conversationTitle } = await handleChatRequest(
      userId,
      apiKey,
      body
    )

    // 5. 返回 SSE 流响应
    return new Response(stream, {
      headers: {
        ...SSE_HEADERS,
        'X-Session-ID': sessionId,
        'X-Conversation-ID': conversationId,
        'X-Conversation-Title': encodeURIComponent(conversationTitle),
      },
    })
  } catch (error) {
    // 错误处理
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 })
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Chat API error:', errorMessage)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
