import type { Metadata } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'PlayStat Admin',
  description: 'PlayStat 관리자 페이지',
  robots: 'noindex, nofollow',
}

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className="font-sans antialiased bg-gray-950">
        {children}
      </body>
    </html>
  )
}
