interface StreamSession {
  fullContent: string
  sentLength: number
  createdAt: number
}

const sessions = new Map<string, StreamSession>()

export const StreamManager = {
  create(id: string, fullContent: string): string {
    const sessionId = `${id}-${Math.random().toString(36).slice(2, 9)}`
    sessions.set(sessionId, {
      fullContent,
      sentLength: 0,
      createdAt: Date.now(),
    })
    return sessionId
  },

  get(sessionId: string): StreamSession | undefined {
    return sessions.get(sessionId)
  },

  updateProgress(sessionId: string, sentLength: number): void {
    const session = sessions.get(sessionId)
    if (session) {
      session.sentLength = sentLength
    }
  },

  cleanup(sessionId: string): void {
    sessions.delete(sessionId)
  },
}
