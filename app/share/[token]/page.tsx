import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SharePageContent } from '@/features/share/components/SharePageContent'
import { renderMarkdownToHtmlResult } from '@/lib/utils/markdown-server'
import { prisma } from '@/server/db/client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const conversation = await getSharedConversation(token)

  if (!conversation) {
    return {
      title: '分享不存在 - MAGIC',
      description: '该分享链接已失效或不存在',
    }
  }

  const author = conversation.user?.username || '用户'
  const description = `查看 ${author} 分享的对话：${conversation.title}`
  const title = `${conversation.title} - MAGIC 分享`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: conversation.sharedAt?.toISOString(),
      authors: [conversation.user?.username || '匿名用户'],
      siteName: 'MAGIC',
      locale: 'zh_CN',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      creator: conversation.user?.username || undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  }
}

export default async function SharePageSSR({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const conversation = await getSharedConversation(token)

  if (!conversation) {
    notFound()
  }

  const messages = await Promise.all(
    conversation.messages.map(async (msg) => {
      const [contentResult, thinkingResult] = await Promise.all([
        renderMarkdownToHtmlResult(msg.content),
        msg.thinking
          ? renderMarkdownToHtmlResult(msg.thinking)
          : Promise.resolve({ html: '', fallbackToPlainText: false }),
      ])

      return {
        id: msg.id,
        role: msg.role,
        content: contentResult.html,
        contentFallbackToPlainText: contentResult.fallbackToPlainText,
        thinking: thinkingResult.html || null,
        thinkingFallbackToPlainText: thinkingResult.fallbackToPlainText,
        createdAt: msg.createdAt.toISOString(),
      }
    })
  )

  const formattedConversation = {
    id: conversation.id,
    title: conversation.title,
    author: conversation.user?.username || '匿名用户',
    createdAt: conversation.createdAt.toISOString(),
    sharedAt:
      conversation.sharedAt?.toISOString() ||
      conversation.createdAt.toISOString(),
    messages,
  }

  return <SharePageContent conversation={formattedConversation} />
}

async function getSharedConversation(token: string) {
  try {
    return await prisma.conversation.findFirst({
      where: {
        shareToken: token,
        isShared: true,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            thinking: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            username: true,
            image: true,
          },
        },
      },
    })
  } catch (error) {
    console.error('Failed to fetch shared conversation:', error)
    return null
  }
}
