'use client'

/**
 * 公开分享页面
 * 
 * 无需登录即可访问
 * URL: /share/[token]
 */

import * as React from 'react'
import { useParams } from 'next/navigation'

interface Message {
  id: string
  role: string
  content: string
  thinking?: string
  createdAt: string
}

interface SharedConversation {
  id: string
  title: string
  author: string
  createdAt: string
  sharedAt: string
  messages: Message[]
}

export default function SharePage() {
  const params = useParams()
  const token = params.token as string

  const [conversation, setConversation] = React.useState<SharedConversation | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchSharedConversation() {
      try {
        const response = await fetch(`/api/share/${token}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('分享的会话不存在或已被取消')
          } else {
            setError('加载失败，请稍后重试')
          }
          return
        }

        const data = await response.json()
        setConversation(data.conversation)
      } catch (err) {
        console.error('Failed to load shared conversation:', err)
        setError('加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedConversation()
  }, [token])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 text-lg">加载中...</div>
        </div>
      </div>
    )
  }

  if (error || !conversation) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-500">
            {error || '会话不存在'}
          </h1>
          <p className="text-muted-foreground">
            此分享链接可能已失效或被删除
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div>
            <h1 className="text-xl font-semibold">{conversation.title}</h1>
            <p className="text-sm text-muted-foreground">
              由 {conversation.author} 分享 • {new Date(conversation.sharedAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              只读模式
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="container mx-auto max-w-3xl px-4 pt-6">
          {conversation.messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">此会话暂无消息</p>
            </div>
          ) : (
            <div className="space-y-6">
              {conversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-lg p-6 ${
                    message.role === 'user'
                      ? 'bg-blue-50 dark:bg-blue-950'
                      : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold">
                      {message.role === 'user' ? '👤 用户' : '🤖 助手'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  
                  {message.thinking && (
                    <div className="mb-4 rounded-md bg-yellow-50 p-4 dark:bg-yellow-950">
                      <p className="mb-2 text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                        💭 思考过程
                      </p>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        {message.thinking}
                      </div>
                    </div>
                  )}
                  
                  <div className="prose dark:prose-invert max-w-none">
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          由 MAGIC 提供支持 • 这是一个只读分享页面
        </div>
      </footer>
    </div>
  )
}

