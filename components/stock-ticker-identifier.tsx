"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { extractTickers } from "@/lib/extract-tickers"
import { Loader2 } from "lucide-react"
import TickerResults from "./ticker-results"
import type { Geography, Language, TickerGroup } from "@/lib/types"
import { loadStocksWithRetry } from "@/lib/stock-cache"
import { TickerDebugView } from "@/app/components/TickerDebugView"

export default function StockTickerIdentifier() {
  const [query, setQuery] = useState("")
  const [geography, setGeography] = useState<Geography>("global")
  const [language, setLanguage] = useState<Language>("english")
  const [apiProvider, setApiProvider] = useState<string>("openai")
  const [results, setResults] = useState<TickerGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCacheLoaded, setIsCacheLoaded] = useState(false)
  const [isCacheLoading, setIsCacheLoading] = useState(false)

  // Listen for API provider changes from the header
  useEffect(() => {
    // Get initial value from localStorage
    const savedProvider = localStorage.getItem('apiProvider')
    if (savedProvider) {
      setApiProvider(savedProvider)
    }
    
    // Listen for changes
    const handleApiProviderChange = (event: CustomEvent<string>) => {
      setApiProvider(event.detail)
    }
    
    window.addEventListener('api-provider-changed', handleApiProviderChange as EventListener)
    
    return () => {
      window.removeEventListener('api-provider-changed', handleApiProviderChange as EventListener)
    }
  }, [])

  // Check cache on initial load and refresh if needed
  useEffect(() => {
    const initCache = async () => {
      setIsCacheLoading(true)
      try {
        // Use the new retry mechanism for more reliable loading
        const stocks = await loadStocksWithRetry()
        
        setIsCacheLoaded(!!stocks)
      } catch (err) {
        console.error("Error initializing cache:", err)
        // Even if there's an error, we'll still consider the cache checked
        setIsCacheLoaded(true)
      } finally {
        setIsCacheLoading(false)
      }
    }

    // Only run this in the browser, not during SSR
    if (typeof window !== 'undefined') {
      initCache()
    } else {
      // Mark as loaded to avoid waiting indefinitely during SSR
      setIsCacheLoaded(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      console.log(
        "Submitting query:",
        query,
        "geography:",
        geography,
        "language:",
        language,
        "apiProvider:",
        apiProvider,
      )
      const tickerGroups = await extractTickers(query, {
        geography,
        language,
        apiProvider,
      })
      console.log("Extracted ticker groups:", tickerGroups)
      setResults(tickerGroups)
    } catch (err) {
      console.error("Error extracting tickers:", err)
      setError("Failed to extract tickers. Please try again.")
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Stock Ticker Identifier</CardTitle>
        <CardDescription>Enter a query in any language to extract stock tickers</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="query" className="mb-2 block">Query</Label>
            <Input
              id="query"
              placeholder="e.g., 'Find me Apple stock price' or '港股阿里巴巴上升趨勢'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <div className="flex-1">
              <Label htmlFor="geography" className="mb-2 block">Geography/Market</Label>
              <Select value={geography} onValueChange={(value) => setGeography(value as Geography)}>
                <SelectTrigger id="geography" className="w-full">
                  <SelectValue placeholder="Geography" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States (NYSE, NASDAQ)</SelectItem>
                  <SelectItem value="hk">Hong Kong (HKEX)</SelectItem>
                  <SelectItem value="china">China (SSE, SZSE)</SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor="language" className="mb-2 block">Language</Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                <SelectTrigger id="language" className="w-full">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="simplified-chinese">Simplified Chinese</SelectItem>
                  <SelectItem value="traditional-chinese">Traditional Chinese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Extract Tickers"
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-start">
        <TickerResults results={results} error={error} />
        {results.length > 0 && <TickerDebugView />}
      </CardFooter>
    </Card>
  )
}

