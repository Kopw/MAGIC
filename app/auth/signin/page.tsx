'use client'

/**
 * Auth SignIn Page - OAuth 取消后的重定向页面
 *
 * 当用户在 OAuth Provider 点击取消时，会重定向到这里。
 * 如果当前窗口是弹窗，则通知父窗口并关闭；否则回到首页。
 */

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthSignInPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const callbackUrl = searchParams.get('callbackUrl')
    const error = searchParams.get('error')
    const isOAuthPopup = sessionStorage.getItem('oauth-popup') === 'true'

    if (isOAuthPopup || window.opener) {
      sessionStorage.removeItem('oauth-popup')

      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: 'oauth-cancelled', error: error || 'cancelled' },
            window.location.origin
          )
        } catch {
          // The opener may already be closed.
        }
      }

      window.close()
      return
    }

    if (!callbackUrl && !error) {
      window.location.href = '/'
    }
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground">正在跳转...</p>
      </div>
    </div>
  )
}
