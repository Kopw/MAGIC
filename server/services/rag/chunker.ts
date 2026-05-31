import type { ChunkInput } from './types'

const MAX_CHARS = 1800
const MIN_CHARS = 240
const OVERLAP_CHARS = 220

interface Section {
  heading?: string
  content: string
  startOffset: number
}

export function estimateTokens(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const nonCjk = text.length - cjk
  return Math.ceil(cjk * 0.75 + nonCjk / 4)
}

export function chunkDocument(text: string): ChunkInput[] {
  const normalized = normalizeText(text)
  if (!normalized) return []

  const markdownSections = splitMarkdownSections(normalized)
  const baseSections = markdownSections.length > 1
    ? markdownSections
    : splitParagraphSections(normalized)

  const chunks: ChunkInput[] = []

  for (const section of baseSections) {
    const content = section.content.trim()
    if (!content) continue

    if (content.length <= MAX_CHARS) {
      appendOrMerge(chunks, {
        content,
        chunkIndex: chunks.length,
        heading: section.heading,
        tokenCount: estimateTokens(content),
        metadata: {
          startOffset: section.startOffset,
          endOffset: section.startOffset + section.content.length,
          source: section.heading ? 'markdown-heading' : 'paragraph-window',
        },
      })
      continue
    }

    const windows = splitLongSection(section)
    for (const window of windows) {
      appendOrMerge(chunks, {
        content: window.content,
        chunkIndex: chunks.length,
        heading: section.heading,
        tokenCount: estimateTokens(window.content),
        metadata: {
          startOffset: window.startOffset,
          endOffset: window.endOffset,
          source: 'sliding-window',
        },
      })
    }
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
    tokenCount: estimateTokens(chunk.content),
  }))
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

function splitMarkdownSections(text: string): Section[] {
  const headingPattern = /^(#{1,4})\s+(.+)$/gm
  const matches = Array.from(text.matchAll(headingPattern))
  if (matches.length === 0) return []

  const sections: Section[] = []
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const next = matches[index + 1]
    const start = match.index ?? 0
    const end = next?.index ?? text.length
    const heading = match[2].trim()
    const content = text.slice(start, end).trim()
    sections.push({ heading, content, startOffset: start })
  }

  const firstHeadingStart = matches[0].index ?? 0
  if (firstHeadingStart > 0) {
    const intro = text.slice(0, firstHeadingStart).trim()
    if (intro) {
      sections.unshift({ content: intro, startOffset: 0 })
    }
  }

  return sections
}

function splitParagraphSections(text: string): Section[] {
  const paragraphs = text.split(/\n{2,}/)
  const sections: Section[] = []
  let searchFrom = 0
  let buffer = ''
  let bufferStart = 0

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    const startOffset = text.indexOf(paragraph, searchFrom)
    searchFrom = startOffset + paragraph.length

    if (!buffer) {
      buffer = trimmed
      bufferStart = Math.max(startOffset, 0)
      continue
    }

    if (buffer.length + trimmed.length + 2 <= MAX_CHARS) {
      buffer += `\n\n${trimmed}`
    } else {
      sections.push({ content: buffer, startOffset: bufferStart })
      buffer = trimmed
      bufferStart = Math.max(startOffset, 0)
    }
  }

  if (buffer) {
    sections.push({ content: buffer, startOffset: bufferStart })
  }

  return sections
}

function splitLongSection(section: Section): Array<{ content: string; startOffset: number; endOffset: number }> {
  const windows: Array<{ content: string; startOffset: number; endOffset: number }> = []
  let start = 0

  while (start < section.content.length) {
    const targetEnd = Math.min(start + MAX_CHARS, section.content.length)
    const end = findNaturalBreak(section.content, start, targetEnd)
    const content = section.content.slice(start, end).trim()

    if (content) {
      windows.push({
        content,
        startOffset: section.startOffset + start,
        endOffset: section.startOffset + end,
      })
    }

    if (end >= section.content.length) break
    start = Math.max(end - OVERLAP_CHARS, start + 1)
  }

  return windows
}

function findNaturalBreak(text: string, start: number, targetEnd: number): number {
  if (targetEnd >= text.length) return text.length

  const window = text.slice(start, targetEnd)
  const breakpoints = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? ']

  for (const breakpoint of breakpoints) {
    const index = window.lastIndexOf(breakpoint)
    if (index > MIN_CHARS) {
      return start + index + breakpoint.length
    }
  }

  return targetEnd
}

function appendOrMerge(chunks: ChunkInput[], next: ChunkInput): void {
  const previous = chunks[chunks.length - 1]
  if (previous && previous.content.length < MIN_CHARS && next.content.length < MAX_CHARS) {
    previous.content = `${previous.content}\n\n${next.content}`.trim()
    previous.metadata.endOffset = next.metadata.endOffset
    return
  }

  chunks.push(next)
}
