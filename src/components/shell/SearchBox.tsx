import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { navigationForRole } from '@/data/navigation'
import { useAuth } from '@/app/auth'
import { useClickOutside } from '@/hooks/useClickOutside'

interface SearchBoxProps {
  id?: string
}

export function SearchBox({
  id = 'platform-global-search',
}: SearchBoxProps) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false), open)

  const results = useMemo(() => {
    if (!query.trim() || !role) return []

    const q = query.toLowerCase()

    return navigationForRole(role)
      .flatMap((section) => section.items)
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, role])

  return (
    <div
      className="relative w-full max-w-sm"
      ref={ref}
    >
      <label
        htmlFor={id}
        className="sr-only"
      >
        Search the platform
      </label>

      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)]"
      />

      <input
        id={id}
        type="search"
        value={query}
        placeholder="Search students, courses, reports…"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-paper)] py-2 pl-9 pr-3 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:bg-white"
      />

      {open && query.trim() && (
        <div className="absolute left-0 right-0 z-30 mt-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white shadow-[var(--shadow-pop)]">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-ink-400)]">
              No matches in your navigation.
            </p>
          ) : (
            <ul className="p-1.5">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(item.path)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)]"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}