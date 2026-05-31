import type { ContextCompressionResult, ContextUsage } from '@/lib/types/context-usage'

export const ContextService = {
  async getUsage(conversationId: string): Promise<ContextUsage> {
    const response = await fetch(`/api/conversations/${conversationId}/context`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch context usage')
    }

    const data = await response.json() as { contextUsage: ContextUsage }
    return data.contextUsage
  },

  async compress(conversationId: string, model: string): Promise<ContextCompressionResult> {
    const response = await fetch(`/api/conversations/${conversationId}/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(data?.error || 'Failed to compress context')
    }

    return response.json()
  },
}
