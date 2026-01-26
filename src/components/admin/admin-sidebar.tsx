'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase-auth'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  FileText,
  LogOut,
  PenSquare,
  Home
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  {
    label: '대시보드',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: '포스트 관리',
    href: '/admin/posts',
    icon: FileText,
  },
  {
    label: '새 포스트',
    href: '/admin/posts/new',
    icon: PenSquare,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()

    // 쿠키 삭제
    document.cookie = 'sb-access-token=; path=/; max-age=0'
    document.cookie = 'sb-refresh-token=; path=/; max-age=0'

    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* 로고 */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">PlayStat Admin</h1>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* 하단 메뉴 */}
      <div className="p-4 border-t border-gray-800 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <Home className="w-5 h-5" />
          사이트로 이동
        </Link>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 px-4 py-3 h-auto text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-950/20"
        >
          <LogOut className="w-5 h-5" />
          로그아웃
        </Button>
      </div>
    </aside>
  )
}
