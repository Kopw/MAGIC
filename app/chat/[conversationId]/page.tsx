'use client'

/**
 * Chat Conversation Page - 会话详情页面
 * 
 * 动态路由页面，每个会话有独立的URL
 * URL 中的 conversationId 是单一数据源
 * 
 * @module app/chat/[conversationId]/page
 */

import { memo, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { ChatService } from '@/features/chat/services/chat.service'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { MessageList } from '@/features/chat/components/MessageList'
import { ChatInput } from '@/features/chat/components/ChatInput'
import { ContextUsagePanel } from '@/features/chat/components/ContextUsagePanel'
import { ConversationList } from '@/features/conversation/components/ConversationList'
import { NewChatButton } from '@/features/conversation/components/NewChatButton'
import { ConversationSearch } from '@/features/conversation/components/ConversationSearch'
import { MainLayout } from '@/components/MainLayout'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { Button } from '@/components/ui/button'

const ChatSidebar = memo(() => (
  <Sidebar>
    <div className="space-y-2">
      <NewChatButton />
      <Button asChild variant="ghost" className="w-full justify-start gap-2">
        <Link href="/knowledge">
          <BookOpen className="h-4 w-4" />
          知识库
        </Link>
      </Button>
      <ConversationSearch />
      <ConversationList />
    </div>
  </Sidebar>
))

ChatSidebar.displayName = 'ChatSidebar'

/**
 * 会话内容组件
 * 
 * URL 中的 conversationId 是单一数据源
 * 组件负责调用 loadMessages 加载消息
 */
function ConversationContent() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.conversationId as string

  // 当 conversationId 变化时，加载消息
  useEffect(() => {
    if (!conversationId) {
      router.push('/')
      return
    }

    ChatService.loadMessages(conversationId)
  }, [conversationId, router])

  return (
    <MainLayout sidebar={<ChatSidebar />} header={<Header />}>
      <MessageList key={conversationId} />
      <ContextUsagePanel conversationId={conversationId} />
      <ChatInput conversationId={conversationId} />
    </MainLayout>
  )
}

export default function ConversationPage() {
  return (
    <AuthGuard redirectTo="/">
      <ConversationContent />
    </AuthGuard>
  )
}
