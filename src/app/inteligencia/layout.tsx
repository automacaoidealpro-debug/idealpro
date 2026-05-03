import { Sidebar } from '@/components/Sidebar'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-14 pb-20 sm:pt-0 sm:pb-0 px-0 sm:p-0">
        {children}
      </main>
    </div>
  )
}
