'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import CacheStatusIndicator from "./cache-status"

export function SiteHeader() {
  const pathname = usePathname()
  const [apiProvider, setApiProvider] = useState<string>("openai")
  const [isCacheLoading, setIsCacheLoading] = useState(false)
  
  // Set API provider in localStorage to persist the selection
  useEffect(() => {
    // Load from localStorage on mount
    const savedProvider = localStorage.getItem('apiProvider')
    if (savedProvider) {
      setApiProvider(savedProvider)
    }
  }, [])
  
  // Update localStorage when apiProvider changes
  useEffect(() => {
    localStorage.setItem('apiProvider', apiProvider)
    // Make the selected provider available to other components
    window.dispatchEvent(new CustomEvent('api-provider-changed', { detail: apiProvider }))
  }, [apiProvider])
  
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Database Explorer', path: '/database' },
  ]
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center">
          <div className="mr-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold">Stock Ticker Identifier</span>
            </Link>
          </div>
          <nav className="hidden sm:flex items-center space-x-4 lg:space-x-6">
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
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="api-provider-header" className="text-sm whitespace-nowrap">API:</Label>
            <Select value={apiProvider} onValueChange={(value) => setApiProvider(value)}>
              <SelectTrigger id="api-provider-header" className="w-[100px] h-8">
                <SelectValue placeholder="API" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {apiProvider === "openai" && "(GPT-4o Mini)"}
              {apiProvider === "deepseek" && "(DeepSeek Chat)"}
            </span>
          </div>
          
          <CacheStatusIndicator isLoading={isCacheLoading} />
        </div>
      </div>
    </header>
  )
} 