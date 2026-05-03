'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Image, Zap, FileText,
  Settings, ChevronLeft, ChevronRight, Brain, TrendingUp, LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard',    label: 'Painel',       icon: LayoutDashboard },
  { href: '/clientes',     label: 'Meta Ads',     icon: Users },
  { href: '/google',       label: 'Google Ads',   icon: TrendingUp },
  { href: '/criativos',    label: 'Criativos',    icon: Image },
  { href: '/otimizacoes',  label: 'Otimizações',  icon: Zap },
  { href: '/inteligencia', label: 'Inteligência', icon: Brain },
  { href: '/relatorios',   label: 'Relatórios',   icon: FileText },
  { href: '/configuracoes',label: 'Config',        icon: Settings },
]

// Items shown in bottom nav on mobile (most used)
const mobileNavItems = navItems.slice(0, 5)

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden sm:flex h-screen bg-gray-900 text-white flex-col transition-all duration-200 flex-shrink-0',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!collapsed && (
            <span className="font-bold text-sm text-blue-400">Ideal Pro</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-700 ml-auto"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-700 space-y-2">
          {!collapsed && (
            <p className="text-xs text-gray-500 truncate">idealproads@outlook.com</p>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 py-3">
        <span className="font-bold text-sm text-blue-400">Ideal Pro</span>
        <button
          onClick={logout}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 flex items-center justify-around px-2 py-2 safe-area-pb">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0',
                active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[9px] font-medium truncate max-w-[44px] text-center leading-tight">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
