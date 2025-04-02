'use client'

import { useState } from 'react'
import { getTickerDebugMap } from '@/lib/prioritize-by-geography'

export function TickerDebugView() {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Get debug info from prioritize-by-geography
  const debugMap = getTickerDebugMap()
  
  if (debugMap.size === 0) {
    return null
  }
  
  return (
    <div className="w-full mt-2 border rounded-md p-4">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        id="debug-info"
      >
        <h3 className="font-semibold text-sm">
          Debug Information {isExpanded ? '▼' : '▶'}
        </h3>
      </div>
      
      {isExpanded && (
        <div className="mt-2 text-xs">
          {Array.from(debugMap.entries()).map(([ticker, info]) => (
            <div key={ticker} className="mb-4 border-b pb-2">
              <h4 className="font-semibold">
                Selected: {ticker} - {info.entity}
              </h4>
              <p>Exchange setting: {info.exchange}</p>
              <p>Selection reason: {info.selectionReason}</p>
              
              <div className="mt-2">
                <p className="font-semibold">All matching tickers:</p>
                <div className="overflow-x-auto">
                  <table className="w-full mt-1 text-left border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-1 text-xs font-medium">Symbol</th>
                        <th className="p-1 text-xs font-medium">Exchange</th>
                        <th className="p-1 text-xs font-medium">Short Name</th>
                        <th className="p-1 text-xs font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.allMatches.map((match, idx) => (
                        <tr 
                          key={idx} 
                          className={ticker === match.symbol ? "bg-yellow-50" : idx % 2 === 0 ? "bg-muted/40" : ""}
                        >
                          <td className="p-1">{match.symbol}</td>
                          <td className="p-1">{match.exchange}</td>
                          <td className="p-1">{match.exchangeShortName}</td>
                          <td className="p-1">{match.matchReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 