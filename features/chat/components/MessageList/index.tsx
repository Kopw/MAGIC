'use client'

/**
 * Message List Module - virtualized chat message list.
 *
 * Combines TanStack Virtual with streaming message rendering and explicit
 * scroll anchoring so reading history is not interrupted by new messages.
 *
 * @module modules/message-list
 */

import { useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { useParams } from 'next/navigation'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useChatStore } from '@/features/chat/store/chat.store'
import { ChatMessage } from '@/features/chat/components/ChatMessage'

const NEAR_BOTTOM_THRESHOLD = 100

interface ScrollSnapshot {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceFromBottom: number
  isNearBottom: boolean
}

function readScrollSnapshot(container: HTMLDivElement): ScrollSnapshot {
  const { scrollTop, scrollHeight, clientHeight } = container
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight

  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    distanceFromBottom,
    isNearBottom: distanceFromBottom <= NEAR_BOTTOM_THRESHOLD,
  }
}

export function MessageList() {
  const params = useParams()
  const conversationId = params.conversationId as string

  const messages = useChatStore((s) => s.messages)
  const isSendingMessage = useChatStore((s) => s.isSendingMessage)
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages)
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)

  const streamingContentLength = useChatStore((s) => {
    if (!s.streamingMessageId) return 0
    const msg = s.messages.find((m) => m.id === s.streamingMessageId)
    if (!msg) return 0
    return (msg.content?.length || 0) + (msg.thinking?.length || 0)
  })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollSnapshotRef = useRef<ScrollSnapshot | null>(null)
  const shouldFollowBottomRef = useRef(true)
  const previousMessagesLength = useRef(0)
  const previousConversationId = useRef<string | null>(null)
  const shouldScrollAfterLoad = useRef(true)
  const scrollToBottomFrameRef = useRef<number | null>(null)
  const restoreScrollFrameRef = useRef<number | null>(null)
  const scrollAfterLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userScrollVersionRef = useRef(0)
  const programmaticScrollTopRef = useRef<number | null>(null)

  useEffect(() => {
    const ids = messages.map((m) => m.id)
    const uniqueIds = new Set(ids)
    if (ids.length !== uniqueIds.size) {
      console.warn('[MessageList] Duplicate message IDs detected!', ids)
    }
  }, [messages])

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const msg = messages[index]
      if (!msg) return 100
      if (msg.thinking) return 250
      if (msg.content.includes('```')) return 300
      if (msg.role === 'user') return 80
      return 150
    },
    overscan: 3,
  })

  const virtualItems = virtualizer.getVirtualItems()

  const updateScrollSnapshot = useCallback((container = scrollContainerRef.current) => {
    if (!container) return null

    const snapshot = readScrollSnapshot(container)
    scrollSnapshotRef.current = snapshot
    return snapshot
  }, [])

  const setProgrammaticScrollTop = useCallback((
    container: HTMLDivElement,
    scrollTop: number
  ) => {
    container.scrollTop = scrollTop
    programmaticScrollTopRef.current = container.scrollTop
    updateScrollSnapshot(container)
  }, [updateScrollSnapshot])

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || !shouldFollowBottomRef.current) return

    setProgrammaticScrollTop(container, container.scrollHeight)

    if (scrollToBottomFrameRef.current !== null) {
      cancelAnimationFrame(scrollToBottomFrameRef.current)
    }

    scrollToBottomFrameRef.current = requestAnimationFrame(() => {
      scrollToBottomFrameRef.current = null
      if (!shouldFollowBottomRef.current) return

      setProgrammaticScrollTop(container, container.scrollHeight)
    })
  }, [setProgrammaticScrollTop])

  const restoreScrollPosition = useCallback((snapshot: ScrollSnapshot) => {
    const container = scrollContainerRef.current
    if (!container) return

    const userScrollVersion = userScrollVersionRef.current

    setProgrammaticScrollTop(container, snapshot.scrollTop)

    if (restoreScrollFrameRef.current !== null) {
      cancelAnimationFrame(restoreScrollFrameRef.current)
    }

    restoreScrollFrameRef.current = requestAnimationFrame(() => {
      restoreScrollFrameRef.current = null
      if (userScrollVersionRef.current !== userScrollVersion) return

      setProgrammaticScrollTop(container, snapshot.scrollTop)
    })
  }, [setProgrammaticScrollTop])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    updateScrollSnapshot(container)

    const handleScroll = () => {
      const snapshot = updateScrollSnapshot(container)
      const programmaticScrollTop = programmaticScrollTopRef.current
      programmaticScrollTopRef.current = null

      if (
        programmaticScrollTop !== null &&
        Math.abs(container.scrollTop - programmaticScrollTop) <= 1
      ) {
        return
      }

      userScrollVersionRef.current += 1
      if (scrollToBottomFrameRef.current !== null) {
        cancelAnimationFrame(scrollToBottomFrameRef.current)
        scrollToBottomFrameRef.current = null
      }
      if (restoreScrollFrameRef.current !== null) {
        cancelAnimationFrame(restoreScrollFrameRef.current)
        restoreScrollFrameRef.current = null
      }
      if (snapshot) {
        shouldFollowBottomRef.current = snapshot.isNearBottom
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollToBottomFrameRef.current !== null) {
        cancelAnimationFrame(scrollToBottomFrameRef.current)
        scrollToBottomFrameRef.current = null
      }
      if (restoreScrollFrameRef.current !== null) {
        cancelAnimationFrame(restoreScrollFrameRef.current)
        restoreScrollFrameRef.current = null
      }
    }
  }, [updateScrollSnapshot])

  useLayoutEffect(() => {
    if (!conversationId) return

    if (previousConversationId.current !== conversationId) {
      previousConversationId.current = conversationId
      previousMessagesLength.current = 0
      scrollSnapshotRef.current = null
      shouldFollowBottomRef.current = true
      shouldScrollAfterLoad.current = true
    }
  }, [conversationId])

  useEffect(() => {
    if (shouldScrollAfterLoad.current && !isLoadingMessages && messages.length > 0) {
      shouldScrollAfterLoad.current = false
      shouldFollowBottomRef.current = true
      scrollAfterLoadTimeoutRef.current = setTimeout(() => {
        scrollAfterLoadTimeoutRef.current = null
        scrollToBottom()
      }, 50)
    }

    return () => {
      if (scrollAfterLoadTimeoutRef.current !== null) {
        clearTimeout(scrollAfterLoadTimeoutRef.current)
        scrollAfterLoadTimeoutRef.current = null
      }
    }
  }, [isLoadingMessages, messages.length, scrollToBottom])

  useLayoutEffect(() => {
    if (messages.length === 0) return

    const isNewMessage = messages.length > previousMessagesLength.current
    previousMessagesLength.current = messages.length

    if (!isNewMessage || shouldScrollAfterLoad.current) return

    const snapshot = scrollSnapshotRef.current
    if (!snapshot || snapshot.isNearBottom) {
      shouldFollowBottomRef.current = true
      scrollToBottom()
      return
    }

    shouldFollowBottomRef.current = false
    restoreScrollPosition(snapshot)
  }, [messages.length, restoreScrollPosition, scrollToBottom])

  useLayoutEffect(() => {
    if (!streamingMessageId) return

    const snapshot = scrollSnapshotRef.current
    if (!snapshot) return

    if (shouldFollowBottomRef.current && snapshot.isNearBottom) {
      scrollToBottom()
      return
    }

    shouldFollowBottomRef.current = false
    restoreScrollPosition(snapshot)
  }, [streamingContentLength, streamingMessageId, restoreScrollPosition, scrollToBottom])

  if (messages.length === 0 && !isSendingMessage && !isLoadingMessages) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="mb-8 text-[32px] font-normal text-[hsl(var(--text-primary))]">
            我能帮你什么？
          </h1>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className="custom-scrollbar-auto flex-1 overflow-y-auto"
      style={{ overflowAnchor: 'none' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
        className="mx-auto max-w-3xl px-6 py-6"
      >
        {virtualItems.map((virtualItem) => {
          const message = messages[virtualItem.index]

          if (!message) {
            console.warn('[MessageList] Missing message at index:', virtualItem.index)
            return null
          }

          return (
            <div
              key={`${virtualItem.index}-${message.id}`}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatMessage messageId={message.id} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
