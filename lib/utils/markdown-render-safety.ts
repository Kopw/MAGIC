export type MarkdownFallbackReason =
  | 'unclosed_fence'
  | 'unclosed_html'
  | 'malformed_table'
  | 'parse_error'
  | 'render_error'

export interface MarkdownRenderSafetyResult {
  shouldFallback: boolean
  reason?: MarkdownFallbackReason
}

export interface MarkdownRenderSafetyOptions {
  isStreaming?: boolean
}

const FENCE_PATTERN = /```/g
const HIGH_RISK_HTML_TAGS = new Set([
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'div',
  'details',
  'summary',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
])

export function analyzeMarkdownRenderSafety(
  content: string,
  options: MarkdownRenderSafetyOptions = {}
): MarkdownRenderSafetyResult {
  if (options.isStreaming || !content.trim()) {
    return { shouldFallback: false }
  }

  try {
    if (hasUnclosedFence(content)) {
      return { shouldFallback: true, reason: 'unclosed_fence' }
    }

    const contentWithoutFences = replaceFencedCodeBlocks(content)

    if (hasUnclosedHighRiskHtml(contentWithoutFences)) {
      return { shouldFallback: true, reason: 'unclosed_html' }
    }

    if (hasMalformedGfmTable(contentWithoutFences)) {
      return { shouldFallback: true, reason: 'malformed_table' }
    }

    return { shouldFallback: false }
  } catch {
    return { shouldFallback: true, reason: 'parse_error' }
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function createPlainTextMarkdownHtml(markdown: string): string {
  return `<pre class="markdown-plain-text">${escapeHtml(markdown)}</pre>`
}

function hasUnclosedFence(content: string): boolean {
  FENCE_PATTERN.lastIndex = 0
  let count = 0
  while (FENCE_PATTERN.exec(content)) count += 1
  return count % 2 === 1
}

function replaceFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '')
}

function hasUnclosedHighRiskHtml(content: string): boolean {
  const stack: string[] = []
  const tagPattern =
    /<!--[\s\S]*?-->|<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^<>]*?)?>/g
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(content)) !== null) {
    const fullTag = match[0]
    const tagName = match[1]?.toLowerCase()
    if (!tagName || !HIGH_RISK_HTML_TAGS.has(tagName)) continue
    if (fullTag.startsWith('<!--') || fullTag.startsWith('<!')) continue
    if (fullTag.endsWith('/>')) continue

    if (fullTag.startsWith('</')) {
      const lastMatchingIndex = stack.lastIndexOf(tagName)
      if (lastMatchingIndex === -1) continue
      stack.splice(lastMatchingIndex, 1)
      continue
    }

    stack.push(tagName)
  }

  return stack.length > 0
}

function hasMalformedGfmTable(content: string): boolean {
  const lines = content.split(/\r?\n/)

  for (let index = 1; index < lines.length; index += 1) {
    const separatorColumns = getTableSeparatorColumnCount(lines[index])
    if (separatorColumns === null) continue

    const headerColumns = getTableRowColumnCount(lines[index - 1])
    if (headerColumns === null || headerColumns !== separatorColumns) {
      return true
    }

    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex]
      if (!line.trim()) break

      const rowColumns = getTableRowColumnCount(line)
      if (rowColumns === null) break
      if (rowColumns !== headerColumns) return true
    }
  }

  return false
}

function getTableSeparatorColumnCount(line: string): number | null {
  const cells = splitTableRow(line)
  if (cells.length < 2) return null

  const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  return isSeparator ? cells.length : null
}

function getTableRowColumnCount(line: string): number | null {
  const cells = splitTableRow(line)
  return cells.length >= 2 ? cells.length : null
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return []

  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return withoutOuterPipes.split('|')
}
