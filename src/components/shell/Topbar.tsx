import { Menu } from 'lucide-react'
import { Breadcrumbs } from '@/components/shell/Breadcrumbs'
import { SearchBox } from '@/components/shell/SearchBox'
import { NotificationMenu } from '@/components/shell/NotificationMenu'
import { UserMenu } from '@/components/shell/UserMenu'

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-md p-2 text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="hidden lg:block">
          <Breadcrumbs />
        </div>

        <div className="ml-auto flex flex-1 items-center justify-end gap-3 lg:flex-none">
          <div className="hidden md:block">
            <SearchBox id="desktop-global-search" />
          </div>
          <NotificationMenu />
          <div className="h-6 w-px bg-[var(--color-line)]" />
          <UserMenu />
        </div>
      </div>
      <div className="border-t border-[var(--color-line)] px-4 py-2 md:hidden">
        <SearchBox id="mobile-global-search" />
      </div>
    </header>
  )
}
