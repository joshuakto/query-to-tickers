"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, HardDrive, MemoryStickIcon as Memory, AlertCircle } from "lucide-react"
import { refreshStockData } from "@/lib/match-stock-symbols"
import { getCacheStatus, hasAttemptedAutoRefresh } from "@/lib/stock-cache"
import type { CacheStatus } from "@/lib/types"

interface CacheStatusIndicatorProps {
  isLoading?: boolean;
}

export default function CacheStatusIndicator({ isLoading }: CacheStatusIndicatorProps = {}) {
  // Initialize with default empty values to avoid server-side rendering issues
  const [status, setStatus] = useState<CacheStatus>({
    isCached: false,
    timestamp: null,
    stockCount: null,
    cacheAge: null,
    isMemoryOnly: false
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [hasTriedAutoRefresh, setHasTriedAutoRefresh] = useState(false)

  // Get cache status only on client-side
  useEffect(() => {
    try {
      setStatus(getCacheStatus())
      setHasTriedAutoRefresh(hasAttemptedAutoRefresh())
    } catch (error) {
      console.error("Error getting initial cache status:", error)
    }
  }, [])

  // Periodically update cache status
  useEffect(() => {
    const updateStatus = () => {
      try {
        setStatus(getCacheStatus())
        setHasTriedAutoRefresh(hasAttemptedAutoRefresh())
      } catch (error) {
        console.error("Error updating cache status:", error)
      }
    };
    
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      await refreshStockData()
      setStatus(getCacheStatus())
    } catch (error) {
      console.error("Error refreshing cache:", error)
      setRefreshError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsRefreshing(false)
    }
  }

  // Display loading state if the parent component is loading the cache
  if (isLoading) {
    return (
      <div className="flex items-center text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // Display no cache but attempted to load
  if (!status.isCached && hasTriedAutoRefresh) {
    return (
      <div className="flex items-center text-xs text-amber-500">
        <AlertCircle className="h-3 w-3 mr-1" />
        <span className="mr-2">Database not loaded</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {status.isCached && (
        <div className="flex items-center">
          {status.isMemoryOnly ? (
            <Memory className="h-3 w-3 mr-1 text-amber-500" />
          ) : (
            <HardDrive className="h-3 w-3 mr-1 text-green-500" />
          )}
          {/* <span className="text-xs text-muted-foreground">
            {status.stockCount?.toLocaleString()} stocks
          </span> */}
        </div>
      )}
      
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={handleRefresh} disabled={isRefreshing}>
        {isRefreshing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </Button>
      
      {refreshError && (
        <div className="absolute top-full right-0 text-xs text-red-500 bg-background border rounded p-1 shadow-md mt-1">
          Error: {refreshError}
        </div>
      )}
    </div>
  )
}

