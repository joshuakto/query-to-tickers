import { type NextRequest, NextResponse } from "next/server"
import { callLlmApi } from "@/lib/api-utils"

export async function POST(request: NextRequest) {
  try {
    const { query, useOpenRouter } = await request.json()
    console.log("Extract entities API called with query:", query, "useOpenRouter:", useOpenRouter)

    if (!query || typeof query !== "string") {
      console.log("Invalid query parameter")
      return NextResponse.json({ error: "Invalid query parameter" }, { status: 400 })
    }

    // Check which API to use based on available keys
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY
    const openrouterApiKey = process.env.OPENROUTER_API_KEY

    // Default to OpenRouter if available
    const shouldUseOpenRouter = useOpenRouter !== false && !!openrouterApiKey
    console.log("Using OpenRouter:", shouldUseOpenRouter)

    if (!deepseekApiKey && !openrouterApiKey) {
      console.log("No API keys configured")
      return NextResponse.json({ error: "No API key configured for DeepSeek or OpenRouter" }, { status: 500 })
    }

    const prompt = `
Extract the text segment that should be used to query for stock ticker.
For Chinese names of stocks that you have not heard of, output various pinyin for it. 

Also, if the user specifies a particular stock exchange/market for a stock, include that information.
For Chinese stocks, be precise about which exchange (Shanghai/SSE or Shenzhen/SZSE) when mentioned.

If multiple entities in the query refer to the same company but with different exchanges, group them together.

Please follow these rules for your response:
 - Directly output the extracted text without the "Response:" prefix
 - Do not include any explanation
 - Always respond with English, for Chinese names of stocks that you have not heard of, output various pinyin for it. 
 - For chinese name of stocks you are fairly confident about, directly output the one English name you know of
 - If a specific exchange/market is mentioned or implied for a stock, format your response as "Stock Name [Exchange]" where Exchange can be: NYSE, NASDAQ, HKEX, SSE, SZSE
 - For Chinese stocks specifically, differentiate between Shanghai (SSE) and Shenzhen (SZSE) exchanges when possible
 - When multiple entities refer to the same company in different exchanges, use this format: "Stock Name [Exchange1/Exchange2]" or separate them with semicolons: "Stock Name [Exchange1]; Stock Name [Exchange2]"
 - If you know the full name of the entity, use the full name in the response

Examples:
Query -- Find me Apple stock price
Response:
Apple

Query -- 港股阿里巴巴上升趨勢
Response:
Alibaba [HKEX]

Query -- Thoughts on HSBC
Response:
HSBC

Query -- compare BABA and NVDA
Response:
BABA, NVDA

Query -- compare Alibaba 港股 and NVDA
Response:
Alibaba [HKEX], NVDA

Query -- compare Alibaba in Hong Kong and US markets
Response:
Alibaba [HKEX/NYSE], NVDA

Query -- 茅台股票
Response:
Kweichow Moutai

Query -- 中國石油A股和H股
Response:
PetroChina [SSE]; PetroChina [HKEX]

Query -- 中芯国际上海和香港股价对比
Response:
Semiconductor Manufacturing International Corporation [SSE]; Semiconductor Manufacturing International Corporation [HKEX]

Query -- 長實走勢圖
Response:
CK Hutchison

Query -- 中芯
Response:
Semiconductor Manufacturing International Corporation

Query -- 台積電走勢
Response:
Taiwan Semiconductor Manufacturing Company

Here is the user query: ${query}
`

    try {
      console.log("Calling LLM API...")
      const fullResponse = await callLlmApi(prompt, shouldUseOpenRouter)
      console.log("LLM API full response:", fullResponse)

      // Extract only the relevant part of the response
      const entities = extractRelevantResponse(fullResponse, query)
      console.log("Extracted entities:", entities)

      return NextResponse.json({ entities })
    } catch (error) {
      console.error("Error calling LLM API:", error)
      return NextResponse.json({ error: "Failed to extract entities from query" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error in extract-entities API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Extract the relevant part of the LLM response, ignoring any prompt template echoing
 */
function extractRelevantResponse(fullResponse: string, originalQuery: string): string {
  // First, try to find if the response contains the original query
  const queryMarker = `Here is the user query: ${originalQuery}`
  const afterQueryIndex = fullResponse.indexOf(queryMarker)

  if (afterQueryIndex !== -1) {
    // Get everything after the query marker
    const afterQuery = fullResponse.substring(afterQueryIndex + queryMarker.length).trim()

    // Split by lines and get the first non-empty line
    const lines = afterQuery
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length > 0) {
      return lines[0]
    }
  }

  // If we can't find the query marker or there's no content after it,
  // try to extract the response based on common patterns

  // Look for lines that don't contain "Query" or "Response:"
  const lines = fullResponse.split("\n")
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (
      trimmedLine &&
      !trimmedLine.includes("Query") &&
      !trimmedLine.includes("Response:") &&
      !trimmedLine.includes("Here is the user query:") &&
      !trimmedLine.includes("Please follow these rules")
    ) {
      return trimmedLine
    }
  }

  // If all else fails, just return the full response
  return fullResponse.trim()
}

