import { useEffect, type RefObject } from 'react'

export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onOutside()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [active, ref, onOutside])
}
