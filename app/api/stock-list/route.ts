import { type NextRequest, NextResponse } from "next/server"
import type { Stock } from "@/lib/types"

// Cache the stock list to avoid repeated API calls
let stockCache: Stock[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 3600000 // 1 hour in milliseconds

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const forceRefresh = url.searchParams.get("refresh") === "true"

    const currentTime = Date.now()

    // Use cached data if available, not expired, and not forcing refresh
    if (stockCache && currentTime - lastFetchTime < CACHE_DURATION && !forceRefresh) {
      return NextResponse.json({ stocks: stockCache })
    }

    const apiKey = process.env.FMP_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "FMP API key not configured" }, { status: 500 })
    }

    console.log("Fetching fresh stock data from FMP API...")
    const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${apiKey}`)

    if (!response.ok) {
      throw new Error(`FMP API error: ${response.status}`)
    }

    const data = await response.json()

    // Filter out invalid or incomplete stock data
    const stocks = data.filter((stock: any) => stock.symbol && stock.name && stock.exchange && stock.exchangeShortName)

    // Update cache
    stockCache = stocks
    lastFetchTime = currentTime

    return NextResponse.json({ stocks })
  } catch (error) {
    console.error("Error fetching stock list:", error)
    return NextResponse.json({ error: "Failed to fetch stock list" }, { status: 500 })
  }
}

