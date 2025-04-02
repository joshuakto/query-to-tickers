import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SiteHeader } from '@/components/site-header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Stock Ticker Identifier',
  description: 'Identify stock tickers from text',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SiteHeader />
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
