import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { StorageManager, STORAGE_KEYS } from '@/lib/utils/storage'
import type { StructuredOutputIssue } from '@/features/chat/types/chat'

type StructuredLanguage = StructuredOutputIssue['language']

interface MarkdownNode {
  type?: string
  lang?: string | null
  value?: string
  url?: string
  children?: MarkdownNode[]
  position?: {
    start?: { offset?: number }
    end?: { offset?: number }
  }
}

interface DetectorOptions {
  trustedImageUrls?: Iterable<string>
  final?: boolean
}

interface CodeBlockMatch {
  language: StructuredLanguage
  value: string
  startOffset: number
  endOffset: number
  original: string
}

const STRUCTURED_LANGUAGES = new Set(['image', 'chart', 'weather'])
const FENCE_PATTERN = /```/g
const FIELD_ORDER_BY_LANGUAGE = {
  image: ['url', 'alt', 'width', 'height'],
  chart: ['type', 'title', 'labels', 'values'],
  weather: ['city', 'temp', 'condition', 'humidity', 'wind'],
} satisfies Record<Exclude<StructuredLanguage, 'markdown'>, string[]>

export function detectStructuredOutputIssues(
  content: string,
  options: DetectorOptions = {}
): StructuredOutputIssue[] {
  if (!content.trim()) return []

  const trustedImageUrls = new Set(options.trustedImageUrls ?? [])
  const issues: StructuredOutputIssue[] = []
  const codeBlocks = collectStructuredCodeBlocks(content)

  for (const block of codeBlocks) {
    if (block.language === 'image') {
      issues.push(...validateImageBlock(block, trustedImageUrls))
    } else if (block.language === 'chart') {
      issues.push(...validateChartBlock(block))
    } else if (block.language === 'weather') {
      issues.push(...validateWeatherBlock(block))
    }
  }

  issues.push(...validateMarkdownImages(content, trustedImageUrls))

  if (options.final && hasUnclosedFence(content)) {
    const startOffset = findLastFenceOffset(content)
    const original = startOffset >= 0 ? content.slice(startOffset) : content
    issues.push(createIssue({
      kind: 'unclosed_fence',
      language: 'markdown',
      reason: '检测到未闭合的 Markdown 代码块',
      startOffset: startOffset >= 0 ? startOffset : Math.max(content.length - original.length, 0),
      endOffset: content.length,
      original,
    }))
  }

  return dedupeIssues(issues)
}

export function getIgnoredStructuredIssueIds(messageId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const parsed = StorageManager.get<unknown>(getIgnoredIssuesStorageKey(messageId))
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

export function saveIgnoredStructuredIssueIds(messageId: string, issueIds: string[]): void {
  if (typeof window === 'undefined') return

  try {
    StorageManager.set(getIgnoredIssuesStorageKey(messageId), Array.from(new Set(issueIds)))
  } catch {
    // localStorage can be unavailable in private browsing modes.
  }
}

function collectStructuredCodeBlocks(content: string): CodeBlockMatch[] {
  const blocks = collectCodeBlocksFromAst(content)
  if (blocks.length > 0) return blocks
  return collectCodeBlocksByRegex(content)
}

function collectCodeBlocksFromAst(content: string): CodeBlockMatch[] {
  let tree: MarkdownNode
  try {
    tree = remark().use(remarkGfm).parse(content) as MarkdownNode
  } catch {
    return []
  }

  const blocks: CodeBlockMatch[] = []
  visitTree(tree, (node) => {
    if (node.type !== 'code') return
    const language = normalizeLanguage(node.lang)
    const startOffset = node.position?.start?.offset
    const endOffset = node.position?.end?.offset
    if (!language || startOffset === undefined || endOffset === undefined) return

    blocks.push({
      language,
      value: node.value || '',
      startOffset,
      endOffset,
      original: content.slice(startOffset, endOffset),
    })
  })

  return blocks
}

function collectCodeBlocksByRegex(content: string): CodeBlockMatch[] {
  const blocks: CodeBlockMatch[] = []
  const pattern = /```([A-Za-z0-9_-]+)[^\n]*\n([\s\S]*?)\n```/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    const language = normalizeLanguage(match[1])
    if (!language) continue
    blocks.push({
      language,
      value: match[2],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      original: match[0],
    })
  }

  return blocks
}

function validateImageBlock(
  block: CodeBlockMatch,
  trustedImageUrls: Set<string>
): StructuredOutputIssue[] {
  const parsed = parseJsonObject(block.value)
  if (!parsed.ok) {
    return [createIssue({
      kind: 'invalid_json',
      language: 'image',
      reason: '图片块不是合法 JSON',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  const url = parsed.value.url
  if (typeof url !== 'string' || url.trim() === '') {
    return [createIssue({
      kind: 'schema_mismatch',
      language: 'image',
      reason: '图片块缺少有效的 url 字段',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  if (!trustedImageUrls.has(url)) {
    return [createIssue({
      kind: 'untrusted_image',
      language: 'image',
      reason: '图片块 URL 不是本次工具调用返回的可信结果',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  return validateFieldOrder(block, parsed.value)
}

function validateChartBlock(block: CodeBlockMatch): StructuredOutputIssue[] {
  const parsed = parseJsonObject(block.value)
  if (!parsed.ok) {
    return [createIssue({
      kind: 'invalid_json',
      language: 'chart',
      reason: '图表块不是合法 JSON',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  const { type, labels, values } = parsed.value
  const isSupportedType = type === 'bar' || type === 'line'
  const hasValidLabels = Array.isArray(labels) && labels.every((item) => typeof item === 'string')
  const hasValidValues = Array.isArray(values) && values.every((item) => typeof item === 'number' && Number.isFinite(item))
  const lengthMatches = Array.isArray(labels) && Array.isArray(values) && labels.length === values.length

  if (!isSupportedType || !hasValidLabels || !hasValidValues || !lengthMatches) {
    return [createIssue({
      kind: 'schema_mismatch',
      language: 'chart',
      reason: '图表块 schema 不匹配：仅支持 bar/line，且 labels 与 values 必须是一一对应的数组',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  return validateFieldOrder(block, parsed.value)
}

function validateWeatherBlock(block: CodeBlockMatch): StructuredOutputIssue[] {
  const parsed = parseJsonObject(block.value)
  if (!parsed.ok) {
    return [createIssue({
      kind: 'invalid_json',
      language: 'weather',
      reason: '天气块不是合法 JSON',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  const { city, temp, condition, humidity } = parsed.value
  const hasRequiredFields =
    typeof city === 'string' &&
    city.trim() !== '' &&
    typeof temp === 'number' &&
    Number.isFinite(temp) &&
    typeof condition === 'string' &&
    condition.trim() !== ''
  const hasValidHumidity =
    humidity === undefined ||
    (typeof humidity === 'number' && Number.isFinite(humidity) && humidity >= 0 && humidity <= 100)

  if (!hasRequiredFields || !hasValidHumidity) {
    return [createIssue({
      kind: 'schema_mismatch',
      language: 'weather',
      reason: '天气块 schema 不匹配：必须包含 city、temp、condition，humidity 需为 0-100 的数字',
      startOffset: block.startOffset,
      endOffset: block.endOffset,
      original: block.original,
    })]
  }

  return validateFieldOrder(block, parsed.value)
}

function validateFieldOrder(
  block: CodeBlockMatch,
  parsed: Record<string, unknown>
): StructuredOutputIssue[] {
  if (block.language === 'markdown') return []

  const expectedOrder = FIELD_ORDER_BY_LANGUAGE[block.language]
  const actualKnownFields = Object.keys(parsed).filter((key) => expectedOrder.includes(key))
  const expectedKnownFields = expectedOrder.filter((key) => Object.hasOwn(parsed, key))
  if (actualKnownFields.length <= 1 || arraysEqual(actualKnownFields, expectedKnownFields)) {
    return []
  }

  return [createIssue({
    kind: 'field_order_mismatch',
    language: block.language,
    reason: `${getLanguageLabel(block.language)}字段顺序不正确：应为 ${expectedOrder.join('、')}`,
    startOffset: block.startOffset,
    endOffset: block.endOffset,
    original: block.original,
  })]
}

function validateMarkdownImages(
  content: string,
  trustedImageUrls: Set<string>
): StructuredOutputIssue[] {
  let tree: MarkdownNode
  try {
    tree = remark().use(remarkGfm).parse(content) as MarkdownNode
  } catch {
    return []
  }

  const issues: StructuredOutputIssue[] = []
  visitTree(tree, (node) => {
    if (node.type !== 'image') return
    const startOffset = node.position?.start?.offset
    const endOffset = node.position?.end?.offset
    if (startOffset === undefined || endOffset === undefined) return
    if (node.url && trustedImageUrls.has(node.url)) return

    const original = content.slice(startOffset, endOffset)
    issues.push(createIssue({
      kind: 'untrusted_image',
      language: 'image',
      reason: 'Markdown 图片链接不是本次工具调用返回的可信结果',
      startOffset,
      endOffset,
      original,
    }))
  })

  return issues
}

function parseJsonObject(value: string): { ok: true; value: Record<string, unknown> } | { ok: false } {
  try {
    const parsed = JSON.parse(value.trim())
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> }
    }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}

function createIssue(input: Omit<StructuredOutputIssue, 'id' | 'excerpt'>): StructuredOutputIssue {
  const excerpt = input.original.replace(/\s+/g, ' ').trim().slice(0, 140)
  return {
    ...input,
    excerpt,
    id: stableHash([
      input.kind,
      input.language,
      String(input.startOffset),
      String(input.endOffset),
      excerpt,
    ].join('|')),
  }
}

function dedupeIssues(issues: StructuredOutputIssue[]): StructuredOutputIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    if (seen.has(issue.id)) return false
    seen.add(issue.id)
    return true
  })
}

function normalizeLanguage(language: string | null | undefined): StructuredLanguage | null {
  const normalized = language?.trim().toLowerCase()
  if (!normalized || !STRUCTURED_LANGUAGES.has(normalized)) return null
  return normalized as StructuredLanguage
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function getLanguageLabel(language: StructuredLanguage): string {
  if (language === 'image') return '图片块'
  if (language === 'chart') return '图表块'
  if (language === 'weather') return '天气块'
  return 'Markdown'
}

function hasUnclosedFence(content: string): boolean {
  return countFenceMarkers(content) % 2 === 1
}

function countFenceMarkers(content: string): number {
  FENCE_PATTERN.lastIndex = 0
  let count = 0
  while (FENCE_PATTERN.exec(content)) count += 1
  return count
}

function findLastFenceOffset(content: string): number {
  return content.lastIndexOf('```')
}

function stableHash(input: string): string {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `soi_${(hash >>> 0).toString(36)}`
}

function visitTree(node: MarkdownNode, visitor: (node: MarkdownNode) => void): void {
  if (!node || typeof node !== 'object') return
  visitor(node)

  if (!Array.isArray(node.children)) return

  for (const child of node.children) {
    visitTree(child, visitor)
  }
}

function getIgnoredIssuesStorageKey(messageId: string): string {
  return `${STORAGE_KEYS.UI.IGNORED_STRUCTURED_OUTPUT_ISSUES_PREFIX}-${messageId}`
}
