import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { getTickerEntityMap } from "@/lib/prioritize-by-geography"
import type { TickerGroup } from "@/lib/types"

interface TickerResultsProps {
  results: TickerGroup[]
  error: string | null
}

export default function TickerResults({ results, error }: TickerResultsProps) {
  // Get entity information for each ticker
  const tickerEntityMap = getTickerEntityMap();
  
  // Debug information to help diagnose issues
  console.log("TickerResults received:", results);
  console.log("TickerEntityMap:", [...tickerEntityMap.entries()]);

  if (error) {
    return (
      <Alert variant="destructive" className="w-full mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // If we got an empty array, show a different message
  if (results.length === 0) {
    return (
      <Alert className="w-full mt-4 bg-gray-50 border-gray-200">
        <Info className="h-4 w-4 text-gray-500" />
        <AlertTitle className="text-gray-800">No Results</AlertTitle>
        <AlertDescription className="text-gray-600">
          No tickers were found for your query. This could be due to:
          <ul className="list-disc ml-5 mt-2 text-sm">
            <li>No recognized stock entity in your query</li>
            <li>No matches found in our database</li>
            <li>An issue with the ticker extraction process</li>
          </ul>
          Try a different query or check the browser console for details.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full mt-4">
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Tickers Found</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="space-y-4">
            {results.map((group) => (
              <div key={group.originalText} className="border-b pb-3 last:border-b-0 last:pb-0">
                <div className="text-sm font-medium text-gray-600 mb-2">
                  For "{group.originalText}":
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.tickers.map((ticker) => {
                    const entity = tickerEntityMap.get(ticker);
                    const exchange = entity?.exchange;
                    
                    // Extract exchange from ticker if it has a suffix like .SS or .HK
                    let exchangeFromSymbol = "";
                    if (ticker.includes(".")) {
                      const suffix = ticker.split(".").pop()?.toUpperCase();
                      if (suffix === "SS" || suffix === "SH") {
                        exchangeFromSymbol = "Shanghai";
                      } else if (suffix === "SZ" || suffix === "SHE") {
                        exchangeFromSymbol = "Shenzhen";
                      } else if (suffix === "HK") {
                        exchangeFromSymbol = "HKEX";
                      } else if (suffix === "L") {
                        exchangeFromSymbol = "London";
                      } else if (suffix) {
                        exchangeFromSymbol = suffix;
                      }
                    }
                    
                    // Determine the badge style based on exchange
                    let badgeStyle = "";
                    let exchangeLabel = exchange || exchangeFromSymbol;
                    
                    if (exchangeLabel.includes("Shanghai") || exchangeLabel === "SSE" || exchangeLabel === "SHH" || exchangeFromSymbol === "Shanghai") {
                      badgeStyle = "border-red-300 bg-red-50";
                      exchangeLabel = "Shanghai";
                    } else if (exchangeLabel.includes("Shenzhen") || exchangeLabel === "SZSE" || exchangeFromSymbol === "Shenzhen") {
                      badgeStyle = "border-red-300 bg-red-50";
                      exchangeLabel = "Shenzhen";
                    } else if (exchangeLabel.includes("Hong Kong") || exchangeLabel === "HKEX" || exchangeLabel === "HKSE" || exchangeFromSymbol === "HKEX") {
                      badgeStyle = "border-blue-300 bg-blue-50";
                      exchangeLabel = "HKEX";
                    } else if (exchangeLabel.includes("NYSE") || exchangeLabel.includes("New York")) {
                      badgeStyle = "border-green-300 bg-green-50";
                      exchangeLabel = "NYSE";
                    } else if (exchangeLabel.includes("NASDAQ")) {
                      badgeStyle = "border-purple-300 bg-purple-50";
                      exchangeLabel = "NASDAQ";
                    } else if (exchangeLabel.includes("London") || exchangeLabel === "LSE") {
                      badgeStyle = "border-yellow-300 bg-yellow-50";
                      exchangeLabel = "LSE";
                    } else if (exchange) {
                      badgeStyle = "border-gray-300 bg-gray-50";
                    }
                    
                    return (
                      <Badge 
                        key={ticker} 
                        variant="outline" 
                        className={`text-sm py-1 px-3 ${badgeStyle || 'bg-white'}`}
                      >
                        <span className="font-medium">{ticker}</span>
                        {(exchange || exchangeFromSymbol) && (
                          <span className="ml-1 text-xs text-gray-600">
                            ({exchangeLabel})
                          </span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

