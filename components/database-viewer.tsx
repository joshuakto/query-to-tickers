'use client'

import { useState, useEffect } from 'react'
import { loadStocksFromCache } from '@/lib/stock-cache'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EnhancedStock } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { findCanonicalExchangeKey, EXCHANGE_MAPPINGS, isStockFromExchange } from '@/lib/prioritize-by-geography'

// Quick filter preset buttons
const QUICK_FILTERS = [
  { name: 'HSBC', search: 'hsbc', symbol: '', exchange: 'all' },
  { name: 'Hong Kong Stocks', search: '', symbol: '.HK', exchange: 'all' },
  { name: 'HKSE Exchange', search: '', symbol: '', exchange: 'HKSE' },
  { name: 'HKEX', search: '', symbol: '', exchange: 'HKEX' },
  { name: 'U.S. Stocks', search: '', symbol: '', exchange: 'NYSE' },
]

export default function DatabaseViewer() {
  const [stocks, setStocks] = useState<EnhancedStock[]>([])
  const [filteredStocks, setFilteredStocks] = useState<EnhancedStock[]>([])
  const [loading, setLoading] = useState(true)
  const [exchangeFilter, setExchangeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [uniqueExchanges, setUniqueExchanges] = useState<string[]>([])
  const [exchangeCounts, setExchangeCounts] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [symbolFilter, setSymbolFilter] = useState('')
  const itemsPerPage = 20

  // Process stocks to add exchange synonyms
  const processStocksWithSynonyms = (stocks: EnhancedStock[]): EnhancedStock[] => {
    return stocks.map(stock => {
      const canonicalKey = findCanonicalExchangeKey(stock.exchangeShortName);
      const synonyms = canonicalKey ? EXCHANGE_MAPPINGS[canonicalKey] || [] : [];
      
      return {
        ...stock,
        exchangeSynonyms: synonyms
      };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const loadedStocks = loadStocksFromCache()
        if (loadedStocks) {
          // Process stocks with exchange synonyms
          const processedStocks = processStocksWithSynonyms(loadedStocks);
          setStocks(processedStocks)
          
          // Extract unique exchanges for the filter dropdown
          const exchanges = new Set<string>()
          const counts: Record<string, number> = { 'all': processedStocks.length }
          
          processedStocks.forEach(stock => {
            if (stock.exchangeShortName) {
              exchanges.add(stock.exchangeShortName)
              
              // Count stocks per exchange
              counts[stock.exchangeShortName] = (counts[stock.exchangeShortName] || 0) + 1
              
              // Also count for canonical exchanges
              const canonicalKey = findCanonicalExchangeKey(stock.exchangeShortName)
              if (canonicalKey && canonicalKey !== stock.exchangeShortName) {
                counts[canonicalKey] = (counts[canonicalKey] || 0) + 1
                exchanges.add(canonicalKey)
              }
            }
          })
          
          setUniqueExchanges(Array.from(exchanges).sort())
          setExchangeCounts(counts)
        }
      } catch (error) {
        console.error('Error loading stocks:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  useEffect(() => {
    // Apply filters when stocks, exchange filter, or search query changes
    let results = [...stocks]
    
    // Apply exchange filter
    if (exchangeFilter && exchangeFilter !== 'all') {
      console.log(`Filtering by exchange: ${exchangeFilter}`);
      
      results = results.filter(stock => 
        isStockFromExchange(stock, exchangeFilter)
      )
    }
    
    // Apply symbol filter (for checking specific patterns like .HK)
    if (symbolFilter) {
      results = results.filter(stock => 
        stock.symbol.includes(symbolFilter)
      )
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      results = results.filter(stock => 
        stock.name.toLowerCase().includes(query) || 
        stock.symbol.toLowerCase().includes(query)
      )
    }
    
    setFilteredStocks(results)
    setPage(1) // Reset to first page when filters change
  }, [stocks, exchangeFilter, searchQuery, symbolFilter])

  const paginatedStocks = filteredStocks.slice((page - 1) * itemsPerPage, page * itemsPerPage)
  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage)

  // Add new function to apply quick filter
  const applyQuickFilter = (filter: { name: string, search: string, symbol: string, exchange: string }) => {
    setSearchQuery(filter.search)
    setSymbolFilter(filter.symbol)
    setExchangeFilter(filter.exchange)
  }

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader>
        <CardTitle>Stock Database Viewer</CardTitle>
        <CardDescription>
          Viewing {filteredStocks.length} stocks out of {stocks.length} total stocks in database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exchange-filter">Exchange Filter</Label>
              <Select
                value={exchangeFilter}
                onValueChange={setExchangeFilter}
              >
                <SelectTrigger id="exchange-filter">
                  <SelectValue placeholder="Select exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges ({exchangeCounts['all'] || 0})</SelectItem>
                  {uniqueExchanges.map(exchange => (
                    <SelectItem key={exchange} value={exchange}>
                      {exchange} ({exchangeCounts[exchange] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="symbol-filter">Symbol Pattern</Label>
              <Input
                id="symbol-filter"
                placeholder="e.g., .HK, .SS"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-query">Search</Label>
              <Input
                id="search-query"
                placeholder="Search by name or symbol"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          {/* Quick filters */}
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-sm font-medium py-1">Quick filters:</span>
            {QUICK_FILTERS.map(filter => (
              <Button 
                key={filter.name} 
                variant="outline" 
                size="sm"
                onClick={() => applyQuickFilter(filter)}
              >
                {filter.name}
              </Button>
            ))}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSymbolFilter('')
                setExchangeFilter('all')
              }}
            >
              Clear Filters
            </Button>
          </div>
          
          {/* Exchange Synonym Test */}
          {!loading && (
            <Card className="bg-gray-50 p-4 my-2">
              <CardTitle className="text-sm font-medium mb-2">Exchange Matching Test</CardTitle>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-1">Check if HKEX matches HKSE stocks:</p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setExchangeFilter('HKEX')}
                    >
                      Test HKEX Filter
                    </Button>
                    <Badge variant="outline">
                      {exchangeFilter === 'HKEX' ? `${filteredStocks.length} matches` : 'Not tested'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs mb-1">Check if HKSE matches HKEX stocks:</p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setExchangeFilter('HKSE')}
                    >
                      Test HKSE Filter
                    </Button>
                    <Badge variant="outline">
                      {exchangeFilter === 'HKSE' ? `${filteredStocks.length} matches` : 'Not tested'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          )}
          
          {loading ? (
            <div className="text-center py-10">Loading stocks...</div>
          ) : (
            <>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Symbol</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Exchange</th>
                      <th className="px-4 py-2 text-left">Short Name</th>
                      <th className="px-4 py-2 text-left">Acronyms</th>
                      <th className="px-4 py-2 text-left">Exchange Synonyms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStocks.map((stock) => (
                      <tr key={stock.symbol} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{stock.symbol}</td>
                        <td className="px-4 py-2">{stock.name}</td>
                        <td className="px-4 py-2">{stock.exchange}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{stock.exchangeShortName}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {stock.acronyms?.map((acronym, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {acronym}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {stock.exchangeSynonyms?.map((synonym: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {synonym}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredStocks.length > itemsPerPage && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          
          {!loading && filteredStocks.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No matching stocks found. Try adjusting your filters.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 