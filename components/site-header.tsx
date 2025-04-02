'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from './ui/button'

export function SiteHeader() {
  const pathname = usePathname()
  
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Database Explorer', path: '/database' },
  ]
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <span className="font-bold">Stock Ticker Identifier</span>
          </Link>
        </div>
        <nav className="flex items-center space-x-4 lg:space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.path 
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
} 