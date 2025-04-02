import type { ExtractedEntity, Stock, EnhancedStock } from "./types"
import Fuse from "fuse.js"
import { loadStocksFromCache, saveStocksToCache } from "./stock-cache"

export async function matchStockSymbols(entities: ExtractedEntity[]): Promise<Stock[]> {
  try {
    console.log("Matching stock symbols for entities:", entities)

    // Try to load stocks from cache (localStorage or memory)
    let enhancedStocks = loadStocksFromCache()

    // If not found, fetch from API
    if (!enhancedStocks) {
      console.log("No cached data found, fetching from API")
      const stocks = await fetchStockData()

      // Save to cache
      saveStocksToCache(stocks)

      // Load from cache again
      enhancedStocks = loadStocksFromCache()

      if (!enhancedStocks) {
        throw new Error("Failed to load stock data after fetching")
      }
    }

    console.log(`Using ${enhancedStocks.length} stocks for matching`)

    const matchedStocks: Stock[] = []

    for (const entity of entities) {
      // Track matches for this entity to avoid duplicates
      const entityMatches = new Set<string>();
      
      // If the entity already has a symbol and it's an exact match, use it
      if (entity.symbol) {
        console.log(`Looking for exact match for symbol: ${entity.symbol}`)

        // Find all stocks that match this symbol (could be listed on multiple exchanges)
        const exactMatches = enhancedStocks.filter(
          (stock) => stock.symbol.toUpperCase() === entity.symbol?.toUpperCase(),
        )

        if (exactMatches.length > 0) {
          console.log(`Found ${exactMatches.length} exact matches for symbol: ${entity.symbol}`)
          // Add all matches so we can prioritize by geography later
          for (const match of exactMatches) {
            matchedStocks.push(match);
            entityMatches.add(match.symbol);
          }
          
          // We'll continue to look for name matches too, rather than skipping
          console.log(`Will also look for name matches for ${entity.name} to find all listings`);
        } else {
          console.log(`No exact match found for symbol: ${entity.symbol}`)
        }
      }

      // Try direct matching with enhanced data first (more efficient)
      const directMatches = findDirectMatches(entity.name, enhancedStocks)
        .filter(match => !entityMatches.has(match.symbol)); // Avoid duplicates
        
      if (directMatches.length > 0) {
        console.log(
          `Found ${directMatches.length} direct matches for ${entity.name}:`,
          directMatches.map((m) => `${m.symbol} (${m.exchangeShortName})`),
        )
        // Add all matches so we can prioritize by geography later
        matchedStocks.push(...directMatches)
        
        // Store the symbols we've already matched
        directMatches.forEach(match => entityMatches.add(match.symbol));
      }

      // Try fuzzy matching if we don't have many matches yet
      if (entityMatches.size < 3) {
        console.log(`Looking for fuzzy matches for: ${entity.name}`);
        const fuzzyMatches = fuzzyMatchStocks(entity.name, enhancedStocks)
          .filter(match => !entityMatches.has(match.symbol)); // Avoid duplicates
          
        if (fuzzyMatches.length > 0) {
          console.log(
            `Found ${fuzzyMatches.length} fuzzy matches:`,
            fuzzyMatches.map((m) => `${m.symbol} (${m.exchangeShortName})`),
          )
          // Add all matches so we can prioritize by geography later
          matchedStocks.push(...fuzzyMatches)
        } else {
          console.log(`No fuzzy matches found for: ${entity.name}`)
        }
      } else {
        console.log(`Already found ${entityMatches.size} matches for ${entity.name}, skipping fuzzy search`);
      }
    }

    console.log(
      "Final matched stocks:",
      matchedStocks.map((s) => `${s.symbol} (${s.exchangeShortName})`),
    )
    return matchedStocks
  } catch (error) {
    console.error("Error matching stock symbols:", error)
    throw error
  }
}

/**
 * Find direct matches using pre-processed data
 */
function findDirectMatches(query: string, stocks: EnhancedStock[]): EnhancedStock[] {
  const normalizedQuery = query.toLowerCase().trim();
  const allMatches = new Set<EnhancedStock>();

  // Try exact symbol match (case insensitive)
  const symbolMatches = stocks.filter((stock) => stock.symbol.toLowerCase() === normalizedQuery);
  symbolMatches.forEach(match => allMatches.add(match));

  // Try acronym match
  const acronymMatches = stocks.filter((stock) =>
    stock.acronyms.some((acronym) => acronym.toLowerCase() === normalizedQuery)
  );
  acronymMatches.forEach(match => allMatches.add(match));

  // Try search terms match
  const termMatches = stocks.filter((stock) => stock.searchTerms.includes(normalizedQuery));
  termMatches.forEach(match => allMatches.add(match));

  // Try matching against cleaned versions of the name
  const cleanedQuery = normalizedQuery.replace(/[^a-z0-9]/g, "").replace(/\s+/g, "");
  const cleanedMatches = stocks.filter((stock) =>
    stock.searchTerms.some((term) => term.replace(/[^a-z0-9]/g, "").replace(/\s+/g, "") === cleanedQuery)
  );
  cleanedMatches.forEach(match => allMatches.add(match));

  // Look for direct substring matches in the company name
  if (normalizedQuery.length > 2) { // Only for queries with more than 2 characters
    const nameMatches = stocks.filter((stock) => 
      stock.name.toLowerCase().includes(normalizedQuery)
    );
    nameMatches.forEach(match => allMatches.add(match));
  }

  return Array.from(allMatches);
}

async function fetchStockData(): Promise<Stock[]> {
  try {
    const response = await fetch("/api/stock-list")

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data.stocks
  } catch (error) {
    console.error("Error fetching stock data:", error)
    throw error
  }
}

function fuzzyMatchStocks(companyName: string, stocks: EnhancedStock[]): EnhancedStock[] {
  // Configure Fuse.js for fuzzy matching with different weights
  const fuse = new Fuse(stocks, {
    keys: [
      { name: "symbol", weight: 0.4 },
      { name: "name", weight: 0.3 },
      { name: "acronyms", weight: 0.2 },
      { name: "searchTerms", weight: 0.1 },
    ],
    threshold: 0.4, // Lower threshold means more strict matching
    includeScore: true,
    minMatchCharLength: 2, // Require at least 2 characters to match
    useExtendedSearch: true,
    ignoreLocation: true,
    shouldSort: true,
  })

  const results = fuse.search(companyName)

  // Return all matches within a reasonable threshold
  return results.filter((result) => result.score && result.score < 0.4).map((result) => result.item)
}

/**
 * Refresh the stock data cache
 */
export async function refreshStockData(): Promise<number> {
  try {
    const response = await fetch("/api/stock-list?refresh=true")

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    // Save to cache
    saveStocksToCache(data.stocks)

    return data.stocks.length
  } catch (error) {
    console.error("Error refreshing stock data:", error)
    throw error
  }
}

