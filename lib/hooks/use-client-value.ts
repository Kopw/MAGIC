import { useMemo, useSyncExternalStore } from 'react'

const subscribeToClient = () => () => {}

/**
 * Calculate a value only after client hydration, while rendering a stable SSR
 * fallback for the initial server and client snapshots.
 */
export function useClientValue<T>(factory: () => T, fallback: T): T {
  const mounted = useIsMounted()

  return useMemo(
    () => (mounted ? factory() : fallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted]
  )
}

export function useIsMounted(): boolean {
  return useSyncExternalStore(subscribeToClient, () => true, () => false)
}
