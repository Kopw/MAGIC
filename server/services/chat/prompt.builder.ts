/**
 * System Prompt 构建器
 * 
 * 管理和构建 AI 的系统提示词
 */

/**
 * 基础系统提示词
 */
const BASE_PROMPT = `You are a helpful assistant. 你是一个友好的 AI 助手。`

const MEMORY_PROMPT = `
当消息中包含 <conversation_summary> 时，它是较早对话的压缩记忆。
- 你应该把它当作背景上下文使用，但如果它与最近消息冲突，以最近消息为准。
- 不要向用户暴露摘要机制，除非用户明确询问上下文管理实现。
`

/**
 * 富媒体格式说明
 */
const RAG_PROMPT = `
当消息中包含 <knowledge_context> 时，你必须优先基于这些资料回答。
- 资料不足以回答时，直接说明“知识库资料不足”，不要编造。
- 回答中涉及知识库事实时，尽量用 [1]、[2] 这样的编号标注来源。
- 不要泄露 chunk 分数、embedding、BM25 或 rerank 的内部细节，除非用户明确询问实现原理。
`

const MEDIA_FORMAT_PROMPT = `
当需要展示特定类型的信息时，请使用以下格式：

1. 天气信息 - 使用 weather 代码块：
\`\`\`weather
{"city": "城市名", "temp": 温度数字, "condition": "天气状况", "humidity": 湿度数字}
\`\`\`

2. 数据图表 - 使用 chart 代码块：
\`\`\`chart
{"type": "bar或line", "title": "图表标题", "labels": ["标签1", "标签2"], "values": [数值1, 数值2]}
\`\`\`

图表限制：
- 仅支持 bar（柱状图）和 line（折线图）两种类型
- 不支持饼图(pie)、散点图(scatter)、雷达图(radar)等其他类型
- 如果用户要求不支持的图表类型，请用文字说明"目前仅支持柱状图和折线图"，并建议使用支持的类型

3. 图片生成 - 当使用 generate_image 工具时：
- 调用工具后，系统会自动处理图片展示，你不需要输出任何 image 代码块
- 禁止自己编造或输出 \`\`\`image\n{...}\n\`\`\` 格式的内容
- 只需要用文字描述图片已生成即可，例如："已为您生成图片"

注意：
- 只在用户明确询问天气或需要数据可视化时才使用这些格式
- 如果用户要求生成图片，请使用 generate_image 工具（如果可用）
`

/**
 * 构建完整的系统提示词
 */
export function buildSystemPrompt(): string {
  return BASE_PROMPT + MEMORY_PROMPT + RAG_PROMPT + MEDIA_FORMAT_PROMPT
}

/**
 * 构建消息上下文
 */
export function buildContextMessages(
  input: {
    historyMessages: Array<{ role: string; content: string }>
    currentUserMessage: string
    ragContext?: string | null
    conversationSummary?: string | null
  }
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const userContent = input.ragContext
    ? `<knowledge_context>\n${input.ragContext}\n</knowledge_context>\n\n<user_question>\n${input.currentUserMessage}\n</user_question>`
    : input.currentUserMessage
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: buildSystemPrompt(),
    },
  ]

  if (input.conversationSummary) {
    messages.push({
      role: 'system',
      content: `<conversation_summary>\n${input.conversationSummary}\n</conversation_summary>`,
    })
  }

  messages.push(
    ...input.historyMessages.map((msg) => ({
      role: normalizePromptRole(msg.role),
      content: msg.content,
    })),
    {
      role: 'user',
      content: userContent,
    },
  )

  return messages
}

function normalizePromptRole(role: string): 'system' | 'user' | 'assistant' {
  if (role === 'assistant' || role === 'system') return role
  return 'user'
}

/**
 * 处理附件，将文件内容添加到消息中
 */
export function appendAttachments(
  content: string,
  attachments?: Array<{ name: string; content: string }>
): string {
  if (!attachments || attachments.length === 0) {
    return content
  }

  const fileContents = attachments
    .map((file) => `\n\n---\n**附件: ${file.name}**\n\`\`\`\n${file.content}\n\`\`\``)
    .join('\n')

  return content + fileContents
}
