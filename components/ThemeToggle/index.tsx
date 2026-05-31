'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useIsMounted } from '@/lib/hooks/use-client-value'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useIsMounted()

  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon"
        className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">切换主题</span>
    </Button>
  )
}
