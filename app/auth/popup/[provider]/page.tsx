'use client'

/**
 * OAuth Popup Page - 弹窗中的 OAuth 登录页面
 * 
 * 使用 next-auth/react 的 signIn 触发 OAuth 流程
 * 登录成功后页面会被重定向，用户手动关闭弹窗
 */

import { signIn } from 'next-auth/react'
import { useParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function OAuthPopupPage() {
  const params = useParams()
  const provider = params.provider as string
  const triggered = useRef(false)

  useEffect(() => {
    if (triggered.current) return

    triggered.current = true

    // 标记当前窗口是 OAuth 弹窗
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('oauth-popup', 'true')
      void signIn(provider, { callbackUrl: '/auth/popup/success' })
    }
  }, [provider])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">正在跳转到 {provider} 登录...</p>
      </div>
    </div>
  )
}
