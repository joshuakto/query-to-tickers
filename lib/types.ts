export type Geography = "us" | "hk" | "china" | "global"
export type Language = "english" | "simplified-chinese" | "traditional-chinese"

export interface Stock {
  symbol: string
  name: string
  exchange: string
  exchangeShortName: string
  type: string
  price?: number
  acronyms?: string[]
  nameWords?: string[]
  searchTerms?: string[]
}

// Minimal representation of a stock for storage efficiency
export interface MinimalStock {
  s: string // symbol
  n: string // name
  e: string // exchangeShortName
}

export interface EnhancedStock extends Stock {
  acronyms: string[]
  nameWords: string[]
  searchTerms: string[]
  exchangeSynonyms?: string[]
}

export interface ExtractedEntity {
  name: string
  symbol?: string
  exchange?: string
  originalText?: string
}

export interface TickerGroup {
  originalText: string
  tickers: string[]
}

export interface ApiConfig {
  apiKey?: string
  useOpenRouter?: boolean
}

export interface CacheStatus {
  isCached: boolean
  timestamp: number | null
  stockCount: number | null
  cacheAge: string | null
  isMemoryOnly: boolean
}

