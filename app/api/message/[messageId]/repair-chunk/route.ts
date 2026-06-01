/**
 * Message Chunk Repair API
 *
 * POST /api/message/[messageId]/repair-chunk
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId } from '@/server/auth/utils'
import { ConversationRepository } from '@/server/repositories/conversation.repository'
import { MessageRepository } from '@/server/repositories/message.repository'
import { UserRepository } from '@/server/repositories/user.repository'
import { createChatCompletionText } from '@/server/services/ai/siliconflow'
import { generateImage } from '@/server/services/image/siliconflow'
import { downloadAndSave } from '@/server/services/image/storage'

const repairRequestSchema = z.object({
  issueId: z.string().min(1),
  kind: z.enum([
    'invalid_json',
    'schema_mismatch',
    'untrusted_image',
    'field_order_mismatch',
    'unclosed_fence',
  ]),
  language: z.enum(['image', 'chart', 'weather', 'markdown']),
  reason: z.string().min(1),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  original: z.string(),
  model: z.string().min(1).optional(),
})

type RepairRequest = z.infer<typeof repairRequestSchema>

interface RepairPayload {
  replacement: string
  trustedImageUrl?: string
}

const DEFAULT_MODEL = 'Qwen/Qwen2.5-7B-Instruct'
const FIELD_ORDER_BY_LANGUAGE = {
  image: ['url', 'alt', 'width', 'height'],
  chart: ['type', 'title', 'labels', 'values'],
  weather: ['city', 'temp', 'condition', 'humidity', 'wind'],
} satisfies Record<Exclude<RepairRequest['language'], 'markdown'>, string[]>

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
): Promise<NextResponse> {
  try {
    const userId = await getCurrentUserId()
    const { messageId } = await params
    const body = repairRequestSchema.parse(await request.json())

    if (body.endOffset < body.startOffset) {
      return NextResponse.json({ error: 'Invalid chunk offset' }, { status: 400 })
    }

    const [message, user] = await Promise.all([
      MessageRepository.findById(messageId),
      UserRepository.findById(userId),
    ])

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const conversation = await ConversationRepository.findById(message.conversationId, userId)
    if (!conversation) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (message.role !== 'assistant') {
      return NextResponse.json({ error: 'Only assistant messages can be repaired' }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentChunk = message.content.slice(body.startOffset, body.endOffset)
    if (currentChunk !== body.original) {
      return NextResponse.json(
        { error: 'Chunk has changed, please re-run detection' },
        { status: 409 }
      )
    }

    const repair =
      body.kind === 'field_order_mismatch'
        ? repairFieldOrderChunk(body)
        : null
    const apiRepair = repair
      ? { replacement: repair }
      : await repairChunk({
          apiKey: getRepairApiKey(user.apiKey),
          issue: body,
          content: message.content,
        })
    const nextContent =
      message.content.slice(0, body.startOffset) +
      apiRepair.replacement +
      message.content.slice(body.endOffset)

    await MessageRepository.update(messageId, { content: nextContent })
    await ConversationRepository.touch(message.conversationId, userId)

    return NextResponse.json({
      success: true,
      issueId: body.issueId,
      replacement: apiRepair.replacement,
      trustedImageUrl: apiRepair.trustedImageUrl,
      content: nextContent,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'API Key not configured') {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 400 })
    }

    console.error('[Message RepairChunk] Error:', error)
    return NextResponse.json({ error: '修复失败' }, { status: 500 })
  }
}

function getRepairApiKey(userApiKey?: string | null): string {
  const apiKey = userApiKey || process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('API Key not configured')
  }
  return apiKey
}

async function repairChunk(input: {
  apiKey: string
  issue: RepairRequest
  content: string
}): Promise<RepairPayload> {
  if (input.issue.kind === 'field_order_mismatch') {
    const fieldOrderRepair = repairFieldOrderChunk(input.issue)
    return {
      replacement: fieldOrderRepair ?? await repairTextChunk(input.apiKey, input.issue, input.content),
    }
  }

  if (input.issue.language === 'image') {
    const imageRepair = await tryRepairImageChunk(input.issue, input.content)
    if (imageRepair) return imageRepair
  }

  return {
    replacement: await repairTextChunk(input.apiKey, input.issue, input.content),
  }
}

async function repairTextChunk(
  apiKey: string,
  issue: RepairRequest,
  content: string
): Promise<string> {
  const schemaInstruction = getSchemaInstruction(issue)
  const context = getRepairContext(content, issue.startOffset, issue.endOffset)

  const repaired = await createChatCompletionText(apiKey, {
    model: issue.model || DEFAULT_MODEL,
    temperature: 0.1,
    maxTokens: 700,
    messages: [
      {
        role: 'system',
        content: [
          'You repair one malformed Markdown structured block.',
          'Return only the replacement text for the selected chunk.',
          'Do not include explanations, surrounding prose, or extra markdown outside the replacement.',
          schemaInstruction,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Issue: ${issue.reason}`,
          `Language: ${issue.language}`,
          '<surrounding_context>',
          context,
          '</surrounding_context>',
          '<original_chunk>',
          issue.original,
          '</original_chunk>',
        ].join('\n'),
      },
    ],
  })

  const normalized = repaired.trim()
  return normalized || fallbackReplacement(issue)
}

async function tryRepairImageChunk(
  issue: RepairRequest,
  content: string
): Promise<RepairPayload | null> {
  const prompt = extractImagePrompt(issue.original) || extractNearbyPrompt(content, issue.startOffset, issue.endOffset)
  if (!prompt) {
    return {
      replacement: '图片内容已移除：原图片块不是可信的工具生成结果。',
    }
  }

  try {
    const result = await generateImage({
      prompt,
      image_size: '1024x1024',
    })
    const stored = await downloadAndSave(result.url)
    const imageData = JSON.stringify({
      url: stored.localUrl,
      alt: prompt,
      width: 1024,
      height: 1024,
    })

    return {
      replacement: `\`\`\`image\n${imageData}\n\`\`\``,
      trustedImageUrl: stored.localUrl,
    }
  } catch (error) {
    console.error('[Message RepairChunk] Image repair failed:', error)
    return {
      replacement: `图片生成未完成：${prompt}`,
    }
  }
}

function getSchemaInstruction(issue: RepairRequest): string {
  if (issue.kind === 'field_order_mismatch') {
    return 'For field order issues, preserve all values and return the same fenced block with top-level JSON fields in the requested order.'
  }

  if (issue.language === 'chart') {
    return [
      'For chart blocks, return exactly a fenced chart block:',
      '```chart',
      '{"type":"bar|line","title":"optional title","labels":["label"],"values":[1]}',
      '```',
      'Only type bar or line is allowed. labels and values must have the same length.',
    ].join('\n')
  }

  if (issue.language === 'weather') {
    return [
      'For weather blocks, return exactly a fenced weather block:',
      '```weather',
      '{"city":"city","temp":25,"condition":"clear","humidity":45}',
      '```',
      'city and condition must be strings. temp must be a number. humidity is optional and must be 0-100.',
    ].join('\n')
  }

  if (issue.language === 'image') {
    return 'For invalid image blocks, return a short plain-text replacement instead of inventing any image URL.'
  }

  return 'For unclosed Markdown, return a syntactically balanced replacement chunk.'
}

function fallbackReplacement(issue: RepairRequest): string {
  if (issue.language === 'image') return '图片内容已移除：原图片块无法验证。'
  if (issue.language === 'chart') return '图表数据无法修复，请重新生成该回答。'
  if (issue.language === 'weather') return '天气数据无法修复，请重新生成该回答。'
  return issue.original.endsWith('```') ? issue.original : `${issue.original}\n\`\`\``
}

function getRepairContext(content: string, startOffset: number, endOffset: number): string {
  const contextStart = Math.max(0, startOffset - 700)
  const contextEnd = Math.min(content.length, endOffset + 700)
  return content.slice(contextStart, contextEnd)
}

function extractImagePrompt(chunk: string): string | null {
  const jsonText = extractFencedBody(chunk)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as { alt?: unknown; prompt?: unknown }
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt : parsed.alt
    return typeof prompt === 'string' && prompt.trim() ? prompt.trim() : null
  } catch {
    return null
  }
}

function extractFencedBody(chunk: string): string | null {
  const match = /```[A-Za-z0-9_-]*\s*\n([\s\S]*?)\n```/.exec(chunk)
  return match?.[1]?.trim() || null
}

function repairFieldOrderChunk(issue: RepairRequest): string | null {
  if (issue.language === 'markdown') return null

  const jsonText = extractFencedBody(issue.original)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const reordered = reorderObjectFields(
      parsed as Record<string, unknown>,
      FIELD_ORDER_BY_LANGUAGE[issue.language]
    )

    return `\`\`\`${issue.language}\n${JSON.stringify(reordered)}\n\`\`\``
  } catch {
    return null
  }
}

function reorderObjectFields(
  value: Record<string, unknown>,
  preferredOrder: string[]
): Record<string, unknown> {
  const reordered: Record<string, unknown> = {}

  for (const key of preferredOrder) {
    if (Object.hasOwn(value, key)) {
      reordered[key] = value[key]
    }
  }

  for (const key of Object.keys(value)) {
    if (!preferredOrder.includes(key)) {
      reordered[key] = value[key]
    }
  }

  return reordered
}

function extractNearbyPrompt(content: string, startOffset: number, endOffset: number): string | null {
  const before = content.slice(Math.max(0, startOffset - 300), startOffset).trim()
  const after = content.slice(endOffset, Math.min(content.length, endOffset + 160)).trim()
  const candidate = [before, after].filter(Boolean).join('\n').replace(/\s+/g, ' ').trim()
  if (!candidate) return null
  return candidate.slice(-500)
}
