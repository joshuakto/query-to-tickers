import type { Geography, Language, ExtractedEntity, TickerGroup } from "./types"
import { extractEntities } from "./extract-entities"
import { matchStockSymbols } from "./match-stock-symbols"
import { prioritizeByGeography, getTickerEntityMap } from "./prioritize-by-geography"

export async function extractTickers(
  query: string,
  geography: Geography,
  language: Language,
  useOpenRouter = false,
): Promise<TickerGroup[]> {
  try {
    // Step 1: Extract potential stock entities from the query
    const entities = await extractEntities(query, useOpenRouter)

    if (!entities.length) {
      return []
    }

    // Step 2: Match extracted entities against FMP stock database
    const matchedStocks = await matchStockSymbols(entities)

    if (!matchedStocks.length) {
      return []
    }

    // Step 3: Prioritize tickers based on user's geography preference and entity exchange info
    const prioritizedTickers = prioritizeByGeography(matchedStocks, geography, entities)
    
    // Step 4: Get the entity information for each ticker
    const tickerEntityMap = getTickerEntityMap()
    
    // Step 5: Group tickers by original text to show which query part they came from
    const tickerGroups: TickerGroup[] = []
    const groupedByOriginalText = new Map<string, string[]>()
    
    // Standard grouping by original text - only prioritized tickers
    for (const ticker of prioritizedTickers) {
      const entity = tickerEntityMap.get(ticker)
      if (!entity) continue
      
      const originalText = entity.originalText || entity.name
      
      if (!groupedByOriginalText.has(originalText)) {
        groupedByOriginalText.set(originalText, [])
      }
      
      groupedByOriginalText.get(originalText)?.push(ticker)
    }
    
    // Enhanced diagnostic logging only - doesn't change displayed results
    // if (isHsbcQuery) {
    //   console.log("HSBC diagnostic logging (these are only in debug info, not visible in results):");
    //   // Find all HSBC stocks for debugging
    //   const hsbcStocks = matchedStocks.filter(stock => 
    //     stock.name.toLowerCase().includes('hsbc') || 
    //     stock.symbol.includes('HSB') ||
    //     stock.symbol === '0005.HK'
    //   );
    //   console.log(`${hsbcStocks.length} HSBC variants found in matchedStocks:`);
    //   hsbcStocks.forEach(stock => {
    //     console.log(`- ${stock.symbol} (${stock.exchangeShortName}): ${stock.name}`);
    //   });
    // }
    
    // Create ticker groups
    for (const [originalText, tickers] of groupedByOriginalText.entries()) {
      tickerGroups.push({
        originalText,
        tickers
      })
    }
    
    return tickerGroups
  } catch (error) {
    console.error("Error in extractTickers:", error)
    throw new Error("Failed to extract tickers")
  }
}

