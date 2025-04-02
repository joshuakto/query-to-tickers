// import { TickerDebugView } from "./TickerDebugView"

// export default function StockTickerIdentifier() {
//   // ... existing code ...

//   return (
//     <Card className="w-full max-w-2xl">
//       <CardHeader>
//         <CardTitle>Stock Ticker Identifier</CardTitle>
//         <CardDescription>Enter a query in any language to extract stock tickers</CardDescription>
//       </CardHeader>
//       <CardContent>
//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div className="space-y-2">
//             <Label htmlFor="query">Query</Label>
//             <Input
//               id="query"
//               placeholder="Example: 'Microsoft stock price' or '阿里巴巴港股'"
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//             />
//           </div>

//           <div className="flex flex-wrap gap-4">
//             <div className="space-y-2 flex-1 min-w-[140px]">
//               <Label htmlFor="geography">Market Preference</Label>
//               <Select value={geography} onValueChange={setGeography}>
//                 <SelectTrigger id="geography">
//                   <SelectValue placeholder="Select market" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="global">Global</SelectItem>
//                   <SelectItem value="us">US</SelectItem>
//                   <SelectItem value="hk">Hong Kong</SelectItem>
//                   <SelectItem value="china">China</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>

//             <div className="space-y-2 flex-1 min-w-[140px]">
//               <Label htmlFor="language">Query Language</Label>
//               <Select value={language} onValueChange={setLanguage}>
//                 <SelectTrigger id="language">
//                   <SelectValue placeholder="Select language" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="auto">Auto Detect</SelectItem>
//                   <SelectItem value="en">English</SelectItem>
//                   <SelectItem value="zh">Chinese</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>

//           <div className="flex items-center space-x-2">
//             <Switch id="use-openrouter" checked={useOpenRouter} onCheckedChange={setUseOpenRouter} />
//             <Label htmlFor="use-openrouter">Use OpenRouter (better Chinese support)</Label>
//           </div>

//           <div className="pt-2">
//             <Button type="submit" disabled={isLoading || !query.trim()}>
//               {isLoading ? (
//                 <>
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   Processing...
//                 </>
//               ) : (
//                 "Get Tickers"
//               )}
//             </Button>
//           </div>
//         </form>

//         {results.length > 0 || error ? (
//           <div className="mt-6">
//             <TickerResults results={results} error={error} />
//             <TickerDebugView />
//           </div>
//         ) : cacheStatus?.isCached ? (
//           <div className="mt-6 text-sm text-gray-500">
//             <CacheStatusIndicator status={cacheStatus} />
//           </div>
//         ) : null}
//       </CardContent>
//       <CardFooter className="flex justify-between">
//         <div className="text-xs text-gray-500">© 2023 Stock Ticker Identifier</div>
//         <div className="flex space-x-2">
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={handleRefreshCache}
//             disabled={isRefreshing}
//             className="text-xs"
//           >
//             {isRefreshing ? (
//               <>
//                 <Loader2 className="mr-2 h-3 w-3 animate-spin" />
//                 Refreshing...
//               </>
//             ) : (
//               "Refresh Cache"
//             )}
//           </Button>
//           <Button variant="outline" size="sm" onClick={handleClearCache} className="text-xs">
//             Clear Cache
//           </Button>
//         </div>
//       </CardFooter>
//     </Card>
//   )
// } 