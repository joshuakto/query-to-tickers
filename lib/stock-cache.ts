import type { Stock, EnhancedStock, MinimalStock, CacheStatus } from "./types"
import { refreshStockData } from "./match-stock-symbols"

// Cache keys
const STOCK_CACHE_KEY_PREFIX = "stock-ticker-cache-"
const CACHE_TIMESTAMP_KEY = "stock-ticker-cache-timestamp"
const CACHE_VERSION = "1.3" // Increment when cache structure changes
const CACHE_VERSION_KEY = "stock-ticker-cache-version"
const CACHE_CHUNKS_KEY = "stock-ticker-cache-chunks"

// Default cache expiration (7 days in milliseconds)
const DEFAULT_CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000

// Maximum chunk size (in bytes) - aim for ~500KB per chunk
const MAX_CHUNK_SIZE = 500 * 1024

// In-memory cache as fallback
let memoryStockCache: EnhancedStock[] | null = null

/**
 * Helper function to check if we're in a browser environment
 */
function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && window.localStorage !== undefined;
}

/**
 * Convert a stock to a minimal representation to save space
 */
function minimizeStock(stock: Stock): MinimalStock {
  // Only store the absolute minimum data needed
  return {
    s: stock.symbol,
    n: stock.name,
    e: stock.exchangeShortName,
  }
}

/**
 * Expand a minimal stock back to full representation
 */
function expandStock(minStock: MinimalStock): Stock {
  return {
    symbol: minStock.s,
    name: minStock.n,
    exchangeShortName: minStock.e,
    exchange: "", // We can infer this from exchangeShortName if needed
    type: "", // We don't need the type for matching
  }
}

/**
 * Extract potential acronyms from a company name
 */
function extractAcronyms(name: string): string[] {
  const acronyms: string[] = []

  // Extract standard acronym (first letter of each word)
  const words = name.split(/\s+/)
  if (words.length > 1) {
    const standardAcronym = words
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()

    if (standardAcronym.length > 1) {
      acronyms.push(standardAcronym)
    }
  }

  // Extract capital letters for companies like "PepsiCo"
  const capitalLetters = name.match(/[A-Z]/g)
  if (capitalLetters && capitalLetters.length > 1) {
    acronyms.push(capitalLetters.join(""))
  }

  // Look for text in parentheses which often contains ticker or acronym
  const parenthesesMatch = name.match(/\(([^)]+)\)/)
  if (parenthesesMatch && parenthesesMatch[1]) {
    acronyms.push(parenthesesMatch[1])
  }

  // Extract meaningful parts of the name
  const meaningfulWords = words.filter(word => 
    word.length > 2 && 
    !["inc", "corp", "ltd", "limited", "co", "company", "the", "and", "of", "group", "holdings", "plc"].includes(word.toLowerCase())
  )

  if (meaningfulWords.length > 1) {
    // Create variations of meaningful word combinations
    const firstLetters = meaningfulWords.map(word => word.charAt(0)).join("").toUpperCase()
    if (firstLetters.length > 1) {
      acronyms.push(firstLetters)
    }

    // Create acronyms from first two letters of each meaningful word
    const twoLetterAcronyms = meaningfulWords
      .map(word => word.slice(0, 2).toUpperCase())
      .filter(acronym => acronym.length === 2)
    acronyms.push(...twoLetterAcronyms)

    // Create acronyms from first and last letter of each meaningful word
    const firstLastAcronyms = meaningfulWords
      .map(word => (word.charAt(0) + word.charAt(word.length - 1)).toUpperCase())
      .filter(acronym => acronym.length === 2)
    acronyms.push(...firstLastAcronyms)
  }

  // Extract common stock suffixes and their variations
  const suffixMatch = name.match(/\.([A-Z]+)$/)
  if (suffixMatch && suffixMatch[1]) {
    acronyms.push(suffixMatch[1])
  }

  return [...new Set(acronyms)] // Remove duplicates
}

/**
 * Pre-processes stock data to enhance searchability
 */
export function enhanceStockData(stocks: Stock[]): EnhancedStock[] {
  return stocks.map((stock) => {
    // Extract potential acronyms from company name
    const acronyms = extractAcronyms(stock.name)

    // Extract words from company name for keyword matching
    const nameWords = stock.name
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 1 && !["inc", "corp", "ltd", "limited", "co", "company", "the", "and", "of", "group", "holdings", "plc"].includes(word),
      )

    // Create search terms combining various forms of the company name
    const searchTerms = [
      stock.name.toLowerCase(),
      ...nameWords,
      ...acronyms.map((a) => a.toLowerCase()),
      // Add variations of the name
      stock.name.toLowerCase().replace(/[^a-z0-9]/g, ""), // Remove special characters
      stock.name.toLowerCase().replace(/\s+/g, ""), // Remove spaces
      // Add exchange-specific variations
      stock.symbol.toLowerCase(),
      stock.symbol.toLowerCase().replace(/\.(SS|HK|TW|US)$/, ""), // Remove exchange suffixes
    ]

    return {
      ...stock,
      acronyms,
      nameWords,
      searchTerms,
    }
  })
}

/**
 * Save stock data to localStorage with chunking
 */
export function saveStocksToCache(stocks: Stock[]): void {
  try {
    // Store in memory first as a fallback
    const enhancedStocks = enhanceStockData(stocks)
    memoryStockCache = enhancedStocks

    // Check if we're in a browser environment before trying to use localStorage
    if (!isBrowserEnvironment()) {
      console.log("Not in browser environment, using memory cache only")
      return;
    }

    // Try to save to localStorage in a compressed format
    try {
      // First, clear any existing cache
      clearStockCache()

      // Convert to minimal representation to save space
      const minimalStocks = stocks.map(minimizeStock)

      // Split the data into chunks to avoid exceeding localStorage limits
      const chunks = splitIntoChunks(minimalStocks)

      // Store the number of chunks
      localStorage.setItem(CACHE_CHUNKS_KEY, chunks.length.toString())

      // Store each chunk separately
      for (let i = 0; i < chunks.length; i++) {
        try {
          localStorage.setItem(`${STOCK_CACHE_KEY_PREFIX}${i}`, JSON.stringify(chunks[i]))
        } catch (chunkError) {
          console.error(`Error saving chunk ${i}:`, chunkError)
          // If we can't save a chunk, we'll have incomplete data
          // But we'll still have the memory cache as fallback
        }
      }

      // Store metadata
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)

      console.log(`Cached ${minimalStocks.length} stocks to localStorage in ${chunks.length} chunks`)
    } catch (storageError) {
      console.error("Error saving to localStorage, using memory cache only:", storageError)
    }
  } catch (error) {
    console.error("Error saving stocks to cache:", error)
  }
}

/**
 * Split an array into chunks of approximately equal size
 */
function splitIntoChunks(data: MinimalStock[]): MinimalStock[][] {
  // First, estimate how many items we can fit in a chunk
  // This is a rough estimate - we'll adjust if needed
  const sampleJson = JSON.stringify(data.slice(0, 10))
  const bytesPerItem = sampleJson.length / 10

  // Calculate how many items per chunk based on MAX_CHUNK_SIZE
  let itemsPerChunk = Math.floor(MAX_CHUNK_SIZE / bytesPerItem)

  // Ensure we have at least 100 items per chunk to avoid too many chunks
  itemsPerChunk = Math.max(100, itemsPerChunk)

  // Split the data into chunks
  const chunks: MinimalStock[][] = []
  for (let i = 0; i < data.length; i += itemsPerChunk) {
    chunks.push(data.slice(i, i + itemsPerChunk))
  }

  return chunks
}

/**
 * Load stock data with retry mechanism
 * @param maxRetries Number of retries to attempt
 * @param retryDelay Delay between retries in milliseconds
 */
let loadingPromise: Promise<EnhancedStock[] | null> | null = null;
let attemptedAutoRefresh = false;

export async function loadStocksWithRetry(
  maxRetries = 3, 
  retryDelay = 1000,
  forceRefresh = false
): Promise<EnhancedStock[] | null> {
  // If already loading, return the existing promise
  if (loadingPromise && !forceRefresh) {
    console.log("Already loading stocks, returning existing promise");
    return loadingPromise;
  }
  
  loadingPromise = new Promise(async (resolve) => {
    let retries = 0;
    let result: EnhancedStock[] | null = null;
    
    // First try to load from memory/localStorage cache
    result = loadStocksFromCache();
    if (result && !forceRefresh) {
      console.log("Successfully loaded stocks from cache");
      resolve(result);
      loadingPromise = null;
      return;
    }
    
    // If no cache or force refresh requested, try to refresh from API with retries
    console.log(forceRefresh ? "Force refresh requested" : "No cache found, trying to refresh");
    
    while (retries < maxRetries) {
      try {
        console.log(`Attempting to refresh stock data (attempt ${retries + 1}/${maxRetries})...`);
        await refreshStockData();
        
        // Check if refresh was successful
        result = loadStocksFromCache();
        if (result) {
          console.log(`Successfully refreshed stock data on attempt ${retries + 1}`);
          attemptedAutoRefresh = true;
          resolve(result);
          loadingPromise = null;
          return;
        }
      } catch (error) {
        console.error(`Error refreshing stock data (attempt ${retries + 1}):`, error);
      }
      
      retries++;
      if (retries < maxRetries) {
        console.log(`Waiting ${retryDelay}ms before next attempt...`);
        await new Promise(r => setTimeout(r, retryDelay));
        // Increase delay for next retry (exponential backoff)
        retryDelay *= 1.5;
      }
    }
    
    console.error(`Failed to load stock data after ${maxRetries} attempts`);
    attemptedAutoRefresh = true;
    resolve(null);
    loadingPromise = null;
  });
  
  return loadingPromise;
}

/**
 * Load stock data from localStorage or memory cache
 */
export function loadStocksFromCache(): EnhancedStock[] | null {
  try {
    // If we have a memory cache, use it
    if (memoryStockCache) {
      console.log(`Using in-memory cache with ${memoryStockCache.length} stocks`)
      return memoryStockCache
    }

    // Check if we're in a browser environment
    if (!isBrowserEnvironment()) {
      console.log("Not in browser environment, no cache available")
      return null;
    }

    // Check cache version first
    const cacheVersion = localStorage.getItem(CACHE_VERSION_KEY)
    if (cacheVersion !== CACHE_VERSION) {
      console.log("Cache version mismatch, returning null")
      return null
    }

    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    const chunksCount = localStorage.getItem(CACHE_CHUNKS_KEY)

    if (!timestamp || !chunksCount) {
      return null
    }

    // Check if cache has expired
    const cacheAge = Date.now() - Number.parseInt(timestamp)
    if (cacheAge > DEFAULT_CACHE_EXPIRATION) {
      console.log("Cache expired, returning null")
      return null
    }

    // Load all chunks and combine them
    const minimalStocks: MinimalStock[] = []
    const numChunks = Number.parseInt(chunksCount, 10)

    for (let i = 0; i < numChunks; i++) {
      const chunkData = localStorage.getItem(`${STOCK_CACHE_KEY_PREFIX}${i}`)
      if (chunkData) {
        try {
          const chunk = JSON.parse(chunkData) as MinimalStock[]
          minimalStocks.push(...chunk)
        } catch (e) {
          console.error(`Error parsing chunk ${i}:`, e)
        }
      }
    }

    if (minimalStocks.length === 0) {
      console.log("No valid chunks found in cache")
      return null
    }

    // Expand the minimal stocks
    const stocks = minimalStocks.map(expandStock)

    // Enhance the stocks for searching
    const enhancedStocks = enhanceStockData(stocks)

    // Also store in memory cache for faster access next time
    memoryStockCache = enhancedStocks

    console.log(
      `Loaded ${enhancedStocks.length} stocks from cache (age: ${Math.round(cacheAge / (1000 * 60 * 60))} hours)`,
    )
    return enhancedStocks
  } catch (error) {
    console.error("Error loading stocks from cache:", error)
    return memoryStockCache // Return memory cache as fallback
  }
}

/**
 * Clear the stock cache
 */
export function clearStockCache(): void {
  // Clear memory cache
  memoryStockCache = null
  
  // Check if we're in a browser environment
  if (!isBrowserEnvironment()) {
    return;
  }
  
  try {
    // Remove metadata
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    localStorage.removeItem(CACHE_VERSION_KEY)

    // Remove chunks
    const chunksCount = localStorage.getItem(CACHE_CHUNKS_KEY)
    if (chunksCount) {
      const numChunks = Number.parseInt(chunksCount, 10)
      for (let i = 0; i < numChunks; i++) {
        localStorage.removeItem(`${STOCK_CACHE_KEY_PREFIX}${i}`)
      }
    }

    localStorage.removeItem(CACHE_CHUNKS_KEY)
  } catch (e) {
    console.error("Error clearing localStorage:", e)
  }
}

/**
 * Get cache status information
 */
export function getCacheStatus(): {
  isCached: boolean
  timestamp: number | null
  stockCount: number | null
  cacheAge: string | null
  isMemoryOnly: boolean
} {
  try {
    // Check memory cache first
    if (memoryStockCache) {
      // Try to get localStorage timestamp if available
      let timestamp: number | null = null
      let isMemoryOnly = true;

      // Check if we're in a browser environment before accessing localStorage
      if (isBrowserEnvironment()) {
        try {
          const timestampStr = localStorage.getItem(CACHE_TIMESTAMP_KEY)
          if (timestampStr) {
            timestamp = Number.parseInt(timestampStr)
            isMemoryOnly = false
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }

      // If no localStorage timestamp, use current time
      if (!timestamp) {
        timestamp = Date.now()
      }

      const cacheAge = Date.now() - timestamp

      // Format cache age as a human-readable string
      let cacheAgeStr: string
      if (cacheAge < 60 * 1000) {
        cacheAgeStr = "just now"
      } else if (cacheAge < 60 * 60 * 1000) {
        cacheAgeStr = `${Math.round(cacheAge / (60 * 1000))} minutes ago`
      } else if (cacheAge < 24 * 60 * 60 * 1000) {
        cacheAgeStr = `${Math.round(cacheAge / (60 * 60 * 1000))} hours ago`
      } else {
        cacheAgeStr = `${Math.round(cacheAge / (24 * 60 * 60 * 1000))} days ago`
      }

      return {
        isCached: true,
        timestamp,
        stockCount: memoryStockCache.length,
        cacheAge: cacheAgeStr,
        isMemoryOnly,
      }
    }

    // If no memory cache, check localStorage
    // First check if we're in a browser environment
    if (!isBrowserEnvironment()) {
      return { isCached: false, timestamp: null, stockCount: null, cacheAge: null, isMemoryOnly: false }
    }
    
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    const chunksCount = localStorage.getItem(CACHE_CHUNKS_KEY)

    if (!timestamp || !chunksCount) {
      return { isCached: false, timestamp: null, stockCount: null, cacheAge: null, isMemoryOnly: false }
    }

    const parsedTimestamp = Number.parseInt(timestamp)
    const cacheAge = Date.now() - parsedTimestamp

    // Count stocks by loading the first chunk
    let stockCount = 0
    const numChunks = Number.parseInt(chunksCount, 10)

    // Try to estimate the total count from the first chunk
    const firstChunkData = localStorage.getItem(`${STOCK_CACHE_KEY_PREFIX}0`)
    if (firstChunkData) {
      try {
        const firstChunk = JSON.parse(firstChunkData) as MinimalStock[]
        stockCount = firstChunk.length * numChunks // Rough estimate
      } catch (e) {
        console.error("Error parsing first chunk:", e)
      }
    }

    // Format cache age as a human-readable string
    let cacheAgeStr: string
    if (cacheAge < 60 * 1000) {
      cacheAgeStr = "just now"
    } else if (cacheAge < 60 * 60 * 1000) {
      cacheAgeStr = `${Math.round(cacheAge / (60 * 1000))} minutes ago`
    } else if (cacheAge < 24 * 60 * 60 * 1000) {
      cacheAgeStr = `${Math.round(cacheAge / (60 * 60 * 1000))} hours ago`
    } else {
      cacheAgeStr = `${Math.round(cacheAge / (24 * 60 * 60 * 1000))} days ago`
    }

    return {
      isCached: true,
      timestamp: parsedTimestamp,
      stockCount,
      cacheAge: cacheAgeStr,
      isMemoryOnly: false,
    }
  } catch (error) {
    console.error("Error getting cache status:", error)

    // Check if we have memory cache as a fallback
    if (memoryStockCache) {
      return {
        isCached: true,
        timestamp: Date.now(),
        stockCount: memoryStockCache.length,
        cacheAge: "just now",
        isMemoryOnly: true,
      }
    }

    return { isCached: false, timestamp: null, stockCount: null, cacheAge: null, isMemoryOnly: false }
  }
}

/**
 * Check if an auto-refresh has been attempted
 */
export function hasAttemptedAutoRefresh(): boolean {
  return attemptedAutoRefresh;
}

