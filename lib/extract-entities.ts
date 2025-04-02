import type { ExtractedEntity, ApiProvider } from "./types"

export async function extractEntities(query: string, apiProvider: ApiProvider = "openrouter"): Promise<ExtractedEntity[]> {
  try {
    console.log("Extracting entities for query:", query, "using API provider:", apiProvider)

    const response = await fetch("/api/extract-entities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, apiProvider }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log("Extracted entities response:", data)

    if (!data.entities || data.entities.trim() === "") {
      console.log("No entities found in response")
      return []
    }

    const parsedEntities = parseExtractedEntities(data.entities)
    console.log("Parsed entities:", parsedEntities)
    return parsedEntities
  } catch (error) {
    console.error("Error extracting entities:", error)
    throw error
  }
}

function parseExtractedEntities(entitiesText: string): ExtractedEntity[] {
  if (!entitiesText || entitiesText.trim() === "") {
    return []
  }

  // Clean up the response - remove any "Response:" prefix or other artifacts
  let cleanedText = entitiesText.trim()
  if (cleanedText.toLowerCase().startsWith("response:")) {
    cleanedText = cleanedText.substring(9).trim()
  }

  // Remove any lines that contain "Query --" or "Here is the user query:"
  cleanedText = cleanedText
    .split("\n")
    .filter((line) => !line.includes("Query --") && !line.includes("Here is the user query:"))
    .join("\n")
    .trim()

  // First, handle semicolon-separated entities (same company, different exchanges)
  // Split by semicolons first to get entity groups
  const entityGroups = cleanedText.split(";").map(group => group.trim())
  
  let allEntities: ExtractedEntity[] = []
  
  // Process each group separately
  for (const group of entityGroups) {
    // Split by commas for different entities within each group
    const commaEntities = group.split(",").map((e) => e.trim())
    
    for (const entity of commaEntities) {
      if (!entity) continue;
      
      // Check if the entity is already a ticker symbol (all caps, possibly with numbers)
      const isTicker = /^[A-Z0-9.]+$/.test(entity)

      if (isTicker) {
        allEntities.push({
          name: entity,
          symbol: entity,
          originalText: entity
        })
        continue
      }

      // Check for multiple exchanges format: "Stock Name [Exchange1/Exchange2]"
      const multiExchangeMatch = entity.match(/(.+)\s*\[([A-Z]+)\/([A-Z]+)\]/)
      if (multiExchangeMatch) {
        const name = multiExchangeMatch[1].trim()
        const exchange1 = multiExchangeMatch[2].trim()
        const exchange2 = multiExchangeMatch[3].trim()
        
        // Add as two separate entities with the same name but different exchanges
        allEntities.push({
          name,
          exchange: exchange1,
          originalText: entity
        })
        
        allEntities.push({
          name,
          exchange: exchange2,
          originalText: entity
        })
        
        continue
      }
      
      // Check if the entity contains single exchange information in brackets [EXCHANGE]
      const exchangeMatch = entity.match(/(.+)\s*\[([A-Z]+)\]/)
      if (exchangeMatch) {
        const name = exchangeMatch[1].trim()
        const exchange = exchangeMatch[2].trim()
        
        allEntities.push({
          name,
          exchange,
          originalText: entity
        })
        
        continue
      }

      // Default case - just the name
      allEntities.push({
        name: entity,
        originalText: entity
      })
    }
  }

  return allEntities.filter((entity) => entity.name)
}

