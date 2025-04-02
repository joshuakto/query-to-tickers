import type { Geography, Stock, ExtractedEntity } from "./types"

// Exchange mappings by geography
const GEOGRAPHY_EXCHANGES: Record<Geography, string[]> = {
  us: ["NYSE", "NASDAQ"],
  hk: ["HKEX", "HKSE"],
  china: ["SSE", "SZSE", "SHH"],
  global: [], // All exchanges
}

// Exchange full names and variants that might be used in the FMP API
export const EXCHANGE_MAPPINGS: Record<string, string[]> = {
  NYSE: ["NYSE", "New York Stock Exchange", "NYQ", "NYSEAMERICAN", "NYSEARCA"],
  NASDAQ: ["NASDAQ", "NASDAQ Global Select", "NASDAQ Global Market", "NASDAQ Capital Market", "NMS", "NGM", "NCM"],
  HKEX: ["HKEX", "HK", "HKSE", "Hong Kong Stock Exchange", "SEHK"],
  HKSE: ["HKSE", "HKEX", "HK", "Hong Kong Stock Exchange", "SEHK"],
  SSE: ["SSE", "Shanghai Stock Exchange", "SHA", "SH"],
  SHH: ["SHH", "Shanghai", "SS"],
  SZSE: ["SZSE", "Shenzhen Stock Exchange", "SHE", "SZ"],
  LSE: ["LSE", "London Stock Exchange", "LON"]
}

// Mapping between tickers and the original extracted entities to preserve information
let tickerToEntityMap: Map<string, ExtractedEntity> = new Map();

// Define a debug info structure to track matching decisions
interface TickerDebugInfo {
  ticker: string;
  entity: string;
  exchange: string;
  allMatches: Array<{
    symbol: string;
    name: string;
    exchange: string;
    exchangeShortName: string;
    matchReason: string;
  }>;
  selectionReason: string;
}

// Mapping from ticker to debug info
let tickerDebugMap: Map<string, TickerDebugInfo> = new Map();

/**
 * Find the canonical exchange key for a given exchange name or symbol
 * This helps normalize different exchange representations from the database
 */
export function findCanonicalExchangeKey(exchangeName: string): string | undefined {
  if (!exchangeName) return undefined;
  
  // First, check if this is already a canonical key
  if (EXCHANGE_MAPPINGS[exchangeName]) {
    return exchangeName;
  }
  
  // Try to find a matching canonical key
  const upperExchange = exchangeName.toUpperCase();
  for (const [key, variants] of Object.entries(EXCHANGE_MAPPINGS)) {
    if (variants.some(variant => variant.toUpperCase() === upperExchange)) {
      return key;
    }
  }
  
  return undefined;
}

/**
 * Check if two exchanges are equivalent (either the same or synonyms of each other)
 */
function areExchangesEquivalent(exchange1: string, exchange2: string): boolean {
  if (!exchange1 || !exchange2) return false;
  
  // Get canonical keys
  const key1 = findCanonicalExchangeKey(exchange1);
  const key2 = findCanonicalExchangeKey(exchange2);
  
  // If both are canonical keys and they match
  if (key1 && key2 && key1 === key2) {
    return true;
  }
  
  // If one is a canonical key and the other is in its variants
  if (key1 && EXCHANGE_MAPPINGS[key1].some(v => v.toUpperCase() === exchange2.toUpperCase())) {
    return true;
  }
  
  if (key2 && EXCHANGE_MAPPINGS[key2].some(v => v.toUpperCase() === exchange1.toUpperCase())) {
    return true;
  }
  
  // Special case for Hong Kong exchanges
  if ((exchange1 === 'HKEX' && exchange2 === 'HKSE') || 
      (exchange1 === 'HKSE' && exchange2 === 'HKEX')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a stock is from a specific exchange
 */
export function isStockFromExchange(stock: Stock, exchangeKey: string): boolean {
  // If exchange key is not valid, return true (match all)
  if (!exchangeKey || exchangeKey === 'all') return true;
  
  // Find the canonical key for the exchange being searched for
  const canonicalKey = findCanonicalExchangeKey(exchangeKey);
  
  if (!canonicalKey) {
    // If we can't find a canonical key, try direct comparison as fallback
    console.log(`No canonical key found for ${exchangeKey}, falling back to direct comparison`);
    return stock.exchangeShortName === exchangeKey || 
           stock.exchange === exchangeKey ||
           stock.symbol.endsWith(`.${exchangeKey}`);
  }
  
  // Check if the stock's exchange short name matches any of the synonyms
  const shortNameMatch = stock.exchangeShortName && 
    EXCHANGE_MAPPINGS[canonicalKey]?.some(
      variant => variant.toUpperCase() === stock.exchangeShortName?.toUpperCase()
    ) || false;
  
  // Check if the stock's exchange matches any of the synonyms
  const exchangeMatch = stock.exchange && 
    EXCHANGE_MAPPINGS[canonicalKey]?.some(
      variant => variant.toUpperCase() === stock.exchange?.toUpperCase()
    ) || false;

  // Check if the stock's symbol has the exchange in it (like .HK)
  const symbolMatch = stock.symbol && 
    EXCHANGE_MAPPINGS[canonicalKey]?.some(variant => {
      // Extract just the suffix code if it's a multi-part variant
      const suffix = variant.includes(' ') 
        ? variant.split(' ')[0].toUpperCase() 
        : variant.toUpperCase();
        
      // Special case for Hong Kong exchange
      if (canonicalKey === 'HKEX' || canonicalKey === 'HKSE') {
        return stock.symbol.toUpperCase().endsWith('.HK');
      }
        
      return stock.symbol.toUpperCase().endsWith(`.${suffix}`) || 
             stock.symbol.toUpperCase().endsWith(`:${suffix}`);
    }) || false;
  
  return shortNameMatch || exchangeMatch || symbolMatch;
}

export function prioritizeByGeography(stocks: Stock[], geography: Geography, entities?: ExtractedEntity[]): string[] {
  console.log(`Prioritizing ${stocks.length} stocks for geography: ${geography}`);
  
  // Reset the maps each time we prioritize
  tickerToEntityMap = new Map();
  tickerDebugMap = new Map();
  
  // Market capitalization data for exchanges
  const marketCapRank: Record<string, number> = {
    'NYSE': 1,
    'NASDAQ': 2,
    'HKEX': 3,
    'HKSE': 3, // Add HKSE with same rank as HKEX
    'LSE': 4,
    'SSE': 5,
    'SHH': 5, // Add SHH with same rank as SSE
    'SS': 5,  // Add SS with same rank as SSE
    'SZSE': 6,
    'SZ': 6   // Add SZ with same rank as SZSE
  };

  // Helper function to get market cap rank with logging
  const getMarketCapRank = (stock: Stock): number => {
    const rank = marketCapRank[stock.exchangeShortName] || 999; // Default to low priority
    
    // Log if this is Apple or a high-profile stock for debugging
    if (stock.name.toLowerCase().includes('apple') || stock.symbol === 'AAPL') {
      console.log(`Market cap rank for ${stock.symbol} (${stock.exchangeShortName}): ${rank}`);
    }
    
    return rank;
  };
  
  // If no entities, just use geography-based selection
  if (!entities || entities.length === 0) {
    const tickers = stocks.map(stock => stock.symbol);
    return tickers;
  }
  
  const prioritizedTickers: string[] = [];
  
  // Process each entity
  for (const entity of entities) {
    console.log(`Processing entity: ${entity.name} with exchange: ${entity.exchange || 'none'}`);
    
    // Normalize the entity name for better matching
    let normalizedName = entity.name.toLowerCase().trim();
    
    // Find matching stocks for this entity
    const matchingStocks = stocks.filter(stock => {
      // Normalize stock name for comparison
      const stockName = stock.name.toLowerCase();
      
      // Check name match - improved to handle partial entity names
      const nameMatch = stockName.includes(normalizedName);

      // Check symbol match
      const symbolMatch = stock.symbol.toLowerCase() === normalizedName;

      // Check acronym match
      const acronymMatch = stock.acronyms?.some(acronym => 
        acronym.toLowerCase() === normalizedName
      );

      // Check words in the name
      const words = stockName.split(/\s+/);
      const wordMatch = words.includes(normalizedName);
      
      // Enhanced matching for numeric stock codes (common in China/HK)
      let numericMatch = false;
      if (/^\d+$/.test(normalizedName)) {
        // If the entity is just numbers (like 00943), check if it's embedded in stock symbols
        numericMatch = stock.symbol.includes(normalizedName);
        
        // Special handling for HK/China numeric stock codes with leading zeros
        if (normalizedName.startsWith('00') && normalizedName.length >= 4) {
          // Try matching without leading zeros (e.g., 00943 -> 943)
          const trimmedCode = normalizedName.replace(/^0+/, '');
          if (trimmedCode.length > 0) {
            numericMatch = numericMatch || stock.symbol.includes(trimmedCode);
          }
        }
        
        // Log numeric matches for debugging
        if (numericMatch) {
          console.log(`Numeric match: ${normalizedName} in ${stock.symbol}`);
        }
      }

      return nameMatch || symbolMatch || acronymMatch || wordMatch || numericMatch;
    });
    
    if (matchingStocks.length === 0) {
      console.log(`No direct matches found for ${entity.name}, checking for fuzzy matches...`);
      
      // Fallback for numeric codes: if no direct matches but we have stocks from fuzzy matching
      if (/^\d+$/.test(normalizedName) && stocks.length > 0) {
        // For numeric codes without matches, use top fuzzy matches
        // This handles cases where fuzzy search found similar but not exact matches
        console.log(`${entity.name} is a numeric code with fuzzy matches available`);
        
        // Sort fuzzy matches to find most relevant ones
        const sortedFuzzyMatches = [...stocks].sort((a, b) => {
          // Prioritize matches that contain the exact number sequence
          const aContainsNumber = a.symbol.includes(normalizedName);
          const bContainsNumber = b.symbol.includes(normalizedName);
          
          if (aContainsNumber && !bContainsNumber) return -1;
          if (!aContainsNumber && bContainsNumber) return 1;
          
          // If both match (or both don't), prioritize by geography
          const aMatchesGeography = isStockFromExchange(a, geography);
          const bMatchesGeography = isStockFromExchange(b, geography);
          
          if (aMatchesGeography && !bMatchesGeography) return -1;
          if (!aMatchesGeography && bMatchesGeography) return 1;
          
          // Finally, sort by symbol length (shorter is often primary)
          return a.symbol.length - b.symbol.length;
        });
        
        // Take top 5 fuzzy matches as alternatives
        const fuzzyMatches = sortedFuzzyMatches.slice(0, 5);
        
        if (fuzzyMatches.length > 0) {
          console.log(`Using top fuzzy matches for ${entity.name}:`, 
            fuzzyMatches.map(m => `${m.symbol} (${m.exchangeShortName})`));
          
          // Create debug info for fuzzy matches
          const debugInfo: TickerDebugInfo = {
            ticker: fuzzyMatches[0].symbol,
            entity: entity.name,
            exchange: entity.exchange || geography,
            allMatches: fuzzyMatches.map(stock => ({
              symbol: stock.symbol,
              name: stock.name,
              exchange: stock.exchange,
              exchangeShortName: stock.exchangeShortName,
              matchReason: "Fuzzy match"
            })),
            selectionReason: "Fuzzy match - no exact match found"
          };
          
          // Add the best fuzzy match to results
          prioritizedTickers.push(fuzzyMatches[0].symbol);
          tickerToEntityMap.set(fuzzyMatches[0].symbol, entity);
          tickerDebugMap.set(fuzzyMatches[0].symbol, debugInfo);
          continue;
        }
      }
      
      console.log(`No matching stocks found for ${entity.name}`);
      continue;
    }
    
    console.log(`Found ${matchingStocks.length} matching stocks for ${entity.name}`);
    
    // Create debug info record with all matches
    const debugInfo: TickerDebugInfo = {
      ticker: "", // Will be set once we select a ticker
      entity: entity.name,
      exchange: entity.exchange || geography, // User specified or geography
      allMatches: matchingStocks.map(stock => ({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        exchangeShortName: stock.exchangeShortName,
        matchReason: "Name match"
      })),
      selectionReason: ""
    };
    
    // Debug each matching stock to help with troubleshooting
    console.log(`Debug info has ${debugInfo.allMatches.length} matches:`);
    matchingStocks.forEach((stock, index) => {
      console.log(`${index + 1}. ${stock.symbol} (${stock.exchangeShortName}): ${stock.exchange}`);
    });
    
    // PRIORITY 1: User-specified exchange in query
    if (entity.exchange) {
      console.log(`Checking for stocks in user-specified exchange: ${entity.exchange}`);
      
      // Find stocks matching the user-specified exchange
      const stocksInSpecifiedExchange = matchingStocks.filter(stock => 
        isStockFromExchange(stock, entity.exchange!)
      );
      
      if (stocksInSpecifiedExchange.length > 0) {
        console.log(`Found ${stocksInSpecifiedExchange.length} stocks in user-specified exchange ${entity.exchange}`);
        
        // Sort by relevance (exact name match first, then exchange match)
        const sortedStocks = [...stocksInSpecifiedExchange].sort((a, b) => {
          const aNameExact = a.name.toLowerCase() === normalizedName;
          const bNameExact = b.name.toLowerCase() === normalizedName;
          
          // Exact name matches first
          if (aNameExact && !bNameExact) return -1;
          if (!aNameExact && bNameExact) return 1;
          
          // Symbols that match the exchange code pattern
          const exchangeCode = entity.exchange!.toLowerCase();
          const aHasExchangeSuffix = a.symbol.toLowerCase().endsWith(`.${exchangeCode}`);
          const bHasExchangeSuffix = b.symbol.toLowerCase().endsWith(`.${exchangeCode}`);
          
          if (aHasExchangeSuffix && !bHasExchangeSuffix) return -1;
          if (!aHasExchangeSuffix && bHasExchangeSuffix) return 1;
          
          // If both have the exchange suffix, shorter symbols are likely more primary listings
          if (aHasExchangeSuffix && bHasExchangeSuffix) {
            return a.symbol.length - b.symbol.length;
          }
          
          return 0;
        });
        
        const ticker = sortedStocks[0].symbol;
        console.log(`Selected best ticker ${ticker} in user-specified exchange ${entity.exchange}`);
        prioritizedTickers.push(ticker);
        tickerToEntityMap.set(ticker, entity);
        
        // Update debug info
        debugInfo.ticker = ticker;
        debugInfo.selectionReason = `User specified exchange: ${entity.exchange}`;
        tickerDebugMap.set(ticker, debugInfo);
        continue;
      }
      
      console.log(`No stocks found in exchange ${entity.exchange} for ${entity.name}`);
    }
    
    // PRIORITY 2: Geography-based selection
    const preferredExchanges = GEOGRAPHY_EXCHANGES[geography];
    console.log(`Preferred exchanges for ${geography}:`, preferredExchanges);
    
    // If geography is global, sort by market capitalization
    if (geography === "global" || preferredExchanges.length === 0) {
      
      // Calculate match scores for more consistent ordering
      const globalMatchScores = new Map<Stock, number>();
      
      matchingStocks.forEach(stock => {
        let score = 0;
        const stockName = stock.name.toLowerCase();
        
        // Name match scoring (same as fallback logic)
        if (stockName === normalizedName) {
          score += 10000; // Exact match
        } else if (stockName.startsWith(normalizedName + ' ')) {
          score += 5000; // Starts with name
        } else if (new RegExp(`\\b${normalizedName}\\b`).test(stockName)) {
          score += 3000; // Word boundary match
        } else if (stockName.includes(normalizedName)) {
          score += 1000; // Contains name
        }
        
        // Prefer primary listings with no suffix
        if (stock.symbol.indexOf('.') === -1) {
          score += 3000;
        }
        
        // Market cap ranking points
        const marketCapRank = getMarketCapRank(stock);
        // Invert and scale the market cap rank (lower rank = higher score)
        score += (1000 - marketCapRank * 100);
        
        // Penalize derivative products
        if (stockName.includes('etf') || 
            stockName.includes('etp') || 
            stockName.includes('tracker') ||
            stockName.includes('short') ||
            stockName.includes('long') ||
            stockName.includes('-1x') ||
            stockName.includes('-2x') ||
            stockName.includes('-3x')) {
          score -= 5000;
        }
        
        globalMatchScores.set(stock, score);
      });
      
      // Enhanced sorting for global mode
      const sortedByMarketCap = [...matchingStocks].sort((a, b) => {
        // Get the scores
        const aScore = globalMatchScores.get(a) || 0;
        const bScore = globalMatchScores.get(b) || 0;
        
        // Sort by score first
        if (aScore !== bScore) {
          return bScore - aScore; // Higher score first
        }
        
        // If scores are equal, additional criteria:
        
        // 1. Exact name matches come first
        const aNameExact = a.name.toLowerCase() === normalizedName;
        const bNameExact = b.name.toLowerCase() === normalizedName;
        
        if (aNameExact && !bNameExact) return -1;
        if (!aNameExact && bNameExact) return 1;
        
        // 2. Primary market (NYSE, NASDAQ) stocks come first
        const aPrimaryMarket = a.symbol.indexOf('.') === -1; // No dots usually means US market
        const bPrimaryMarket = b.symbol.indexOf('.') === -1;
        
        if (aPrimaryMarket && !bPrimaryMarket) return -1;
        if (!aPrimaryMarket && bPrimaryMarket) return 1;
        
        // 3. Sort by market cap rank
        const aMarketCapRank = getMarketCapRank(a);
        const bMarketCapRank = getMarketCapRank(b);
        return aMarketCapRank - bMarketCapRank;
      });
      
      const ticker = sortedByMarketCap[0].symbol;
      console.log(`Using market cap sorted match for ${entity.name}: ${ticker} (global setting)`);
      console.log(`Top 5 matches with scores:`, sortedByMarketCap.slice(0, 5).map(s => 
        `${s.symbol} (${s.exchangeShortName}): score ${globalMatchScores.get(s) || 0}`
      ));
      
      prioritizedTickers.push(ticker);
      tickerToEntityMap.set(ticker, entity);
      
      // Update debug info
      debugInfo.ticker = ticker;
      debugInfo.selectionReason = `Global setting, sorted by match quality and market cap`;
      tickerDebugMap.set(ticker, debugInfo);
      continue;
    }
    
    // Find stocks in preferred exchanges based on exchange synonyms
    const stocksInPreferredExchanges = matchingStocks.filter(stock => {
      // Check each preferred exchange for this geography
      for (const preferredExchange of preferredExchanges) {
        if (isStockFromExchange(stock, preferredExchange)) {
          console.log(`Stock ${stock.symbol} matches preferred exchange ${preferredExchange} for ${geography}`);
          return true;
        }
      }
      return false;
    });
    
    console.log(`Found ${stocksInPreferredExchanges.length} stocks in preferred exchanges for ${geography}`);
    
    // Update all matching stocks with match reason
    stocksInPreferredExchanges.forEach(stock => {
      const matchIndex = debugInfo.allMatches.findIndex(m => m.symbol === stock.symbol);
      if (matchIndex >= 0) {
        debugInfo.allMatches[matchIndex].matchReason = `Matches preferred exchange for ${geography}`;
      }
    });
    
    if (stocksInPreferredExchanges.length > 0) {
      // Sort the matched stocks to prioritize exact exchange matches
      const sortedStocks = [...stocksInPreferredExchanges].sort((a, b) => {
        // For Hong Kong geography, prioritize .HK stocks
        if (geography === 'hk') {
          const aIsHK = a.symbol.endsWith('.HK');
          const bIsHK = b.symbol.endsWith('.HK');
          if (aIsHK && !bIsHK) return -1;
          if (!aIsHK && bIsHK) return 1;
          
          // For two HK stocks, prefer shorter numeric codes (primary listings)
          if (aIsHK && bIsHK) {
            // Extract numeric part before .HK
            const aCode = a.symbol.split('.')[0];
            const bCode = b.symbol.split('.')[0];
            // If both are numeric, shorter ones are typically primary
            if (/^\d+$/.test(aCode) && /^\d+$/.test(bCode)) {
              return aCode.length - bCode.length;
            }
          }
        }
        
        // For US geography, prioritize stock without a suffix (pure US stocks)
        if (geography === 'us') {
          const aIsUS = !a.symbol.includes('.');
          const bIsUS = !b.symbol.includes('.');
          if (aIsUS && !bIsUS) return -1;
          if (!aIsUS && bIsUS) return 1;
        }
        
        // For China geography, prioritize .SS and .SZ stocks
        if (geography === 'china') {
          const aIsChina = a.symbol.endsWith('.SS') || a.symbol.endsWith('.SZ');
          const bIsChina = b.symbol.endsWith('.SS') || b.symbol.endsWith('.SZ');
          if (aIsChina && !bIsChina) return -1;
          if (!aIsChina && bIsChina) return 1;
        }
        
        return 0;
      });
      
      const ticker = sortedStocks[0].symbol;
      console.log(`Selected ticker ${ticker} in preferred exchange for ${entity.name} (${geography} setting)`);
      prioritizedTickers.push(ticker);
      tickerToEntityMap.set(ticker, entity);
      
      // Update debug info
      debugInfo.ticker = ticker;
      debugInfo.selectionReason = `Matched preferred exchange for ${geography}`;
      tickerDebugMap.set(ticker, debugInfo);
      continue;
    }
    
    // PRIORITY 3: First available match as fallback
    if (matchingStocks.length > 1) {
      console.log(`Using fallback matching logic for ${entity.name} with ${matchingStocks.length} matches`);
      
      // Create a detailed log of all matches for debugging
      console.log("All available matches:");
      matchingStocks.forEach(stock => {
        console.log(`- ${stock.symbol} (${stock.exchangeShortName}): ${stock.name}`);
      });
      
      // Calculating scores for matching quality - this ensures consistent ordering
      const matchScores = new Map<Stock, number>();
      
      matchingStocks.forEach(stock => {
        let score = 0;
        const stockName = stock.name.toLowerCase();
        const stockSymbol = stock.symbol.toLowerCase();
        
        // Exact name match gets highest priority (e.g., "Apple Inc." for "Apple")
        if (stockName === normalizedName) {
          score += 10000;
        }
        // Name starts with the entity name (e.g., "Apple Corp" for "Apple")
        else if (stockName.startsWith(normalizedName + ' ')) {
          score += 5000;
        }
        // Word boundary match (e.g., "Big Apple Inc" for "Apple")
        else if (new RegExp(`\\b${normalizedName}\\b`).test(stockName)) {
          score += 3000;
        }
        // Name contains entity name
        else if (stockName.includes(normalizedName)) {
          score += 1000;
        }
        
        // Check if normalizedName is a word in the stock name (tokenized)
        const nameWords = stockName.split(/\s+/);
        if (nameWords.includes(normalizedName)) {
          score += 500;
        }
        
        // Exact symbol match gets very high priority
        if (stockSymbol === normalizedName) {
          score += 8000;
        }
        // Symbol starts with entity name (e.g., AAPL for Apple)
        else if (stockSymbol.startsWith(normalizedName.substring(0, 2))) {
          score += 2000;
        }
        
        // Boost primary exchanges
        if (stock.exchangeShortName === 'NYSE' || stock.exchangeShortName === 'NASDAQ') {
          score += 500;
        }
        
        // Penalize obvious poor matches
        if (stock.name.toLowerCase().includes('tracker') || 
            stock.name.toLowerCase().includes('-1x') || 
            stock.name.toLowerCase().includes('-2x') ||
            stock.name.toLowerCase().includes('-3x') ||
            stock.name.toLowerCase().includes('short') ||
            stock.name.toLowerCase().includes('etf') ||
            stock.name.toLowerCase().includes('etp')) {
          score -= 1000;
        }
        
        // Assign the score
        matchScores.set(stock, score);
      });
      
      // Improved intelligent sorting algorithm that is more stable
      const sortedMatches = [...matchingStocks].sort((a, b) => {
        // Sort by match score for more consistent ordering
        const aScore = matchScores.get(a) || 0;
        const bScore = matchScores.get(b) || 0;
        
        if (aScore !== bScore) {
          return bScore - aScore; // Higher score first
        }
        
        // If scores are equal, use additional criteria
        
        // 1. Prefer exact name matches
        const aNameExact = a.name.toLowerCase() === normalizedName;
        const bNameExact = b.name.toLowerCase() === normalizedName;
        
        if (aNameExact && !bNameExact) return -1;
        if (!aNameExact && bNameExact) return 1;
        
        // 2. Prefer listings matching the selected geography
        if (geography === 'hk') {
          const aIsHK = a.symbol.endsWith('.HK');
          const bIsHK = b.symbol.endsWith('.HK');
          if (aIsHK && !bIsHK) return -1;
          if (!aIsHK && bIsHK) return 1;
        } else if (geography === 'us') {
          const aIsUS = !a.symbol.includes('.');
          const bIsUS = !b.symbol.includes('.');
          if (aIsUS && !bIsUS) return -1;
          if (!aIsUS && bIsUS) return 1;
        } else if (geography === 'china') {
          const aIsChina = a.symbol.endsWith('.SS') || a.symbol.endsWith('.SZ');
          const bIsChina = b.symbol.endsWith('.SS') || b.symbol.endsWith('.SZ');
          if (aIsChina && !bIsChina) return -1;
          if (!aIsChina && bIsChina) return 1;
        }
        
        // 3. Prefer primary markets over secondary listings
        const primaryMarkets: Record<string, number> = {
          'NYSE': 3,
          'NASDAQ': 3,
          'HKSE': 3,
          'HKEX': 3,
          'LSE': 2,
          'SSE': 2,
          'SZSE': 2
        };
        
        const aMarketPriority = primaryMarkets[a.exchangeShortName] || 0;
        const bMarketPriority = primaryMarkets[b.exchangeShortName] || 0;
        
        if (aMarketPriority !== bMarketPriority) {
          return bMarketPriority - aMarketPriority;
        }
        
        // 4. For same exchange priority, use symbol length (shorter is often primary)
        return a.symbol.length - b.symbol.length;
      });
      
      const ticker = sortedMatches[0].symbol;
      const matchScore = matchScores.get(sortedMatches[0]) || 0;
      console.log(`Selected best match using smart prioritization: ${ticker} (${sortedMatches[0].exchangeShortName}) with score ${matchScore}`);
      console.log(`Top 5 matches with scores:`, sortedMatches.slice(0, 5).map(s => `${s.symbol} (${s.exchangeShortName}): score ${matchScores.get(s) || 0}`));
      
      prioritizedTickers.push(ticker);
      tickerToEntityMap.set(ticker, entity);
      
      // Update debug info
      debugInfo.ticker = ticker;
      debugInfo.selectionReason = `Smart fallback prioritization with score ${matchScore}`;
      tickerDebugMap.set(ticker, debugInfo);
    } else {
      const ticker = matchingStocks[0].symbol;
      console.log(`Only one match for ${entity.name}: ${ticker}`);
      prioritizedTickers.push(ticker);
      tickerToEntityMap.set(ticker, entity);
      
      // Update debug info
      debugInfo.ticker = ticker;
      debugInfo.selectionReason = `Only one match available`;
      tickerDebugMap.set(ticker, debugInfo);
    }
  }
  
  console.log("Final prioritized tickers:", prioritizedTickers);
  return prioritizedTickers;
}

// Export the map to be used by the display component
export function getTickerEntityMap(): Map<string, ExtractedEntity> {
  return tickerToEntityMap;
}

// Export the debug map to be used for UI display
export function getTickerDebugMap(): Map<string, TickerDebugInfo> {
  return tickerDebugMap;
}



