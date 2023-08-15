import { useCallback, useContext } from "react"
import { AppContext } from "../utils/context"
import { fakeFetch, RegisteredEndpoints } from "../utils/fetch"
import { useWrappedRequest } from "./useWrappedRequest"
import { Transaction } from "src/utils/types"

export function useCustomFetch() {
  const { cache } = useContext(AppContext)
  const { loading, wrappedRequest } = useWrappedRequest()

  const fetchWithCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const cacheKey = getCacheKey(endpoint, params)
        const cacheResponse = cache?.current.get(cacheKey)

        if (cacheResponse) {
          const data = JSON.parse(cacheResponse)
          return data as Promise<TData>
        }

        const result = await fakeFetch<TData>(endpoint, params)
        cache?.current.set(cacheKey, JSON.stringify(result))
        return result
      }),
    [cache, wrappedRequest]
  )

  const changeApprovalForId = (transactionId: string, transaction: Transaction, newValue: boolean) => {
    if (transaction.id === transactionId) {
      return { ...transaction, approved: newValue }
    }
    return transaction
  }

  const getKeysByCacheStart = useCallback(
    (cacheStart: string) => {
      if (cache?.current === undefined) {
        return []
      }
      return Array.from(cache.current.keys()).filter((key) => key.startsWith(cacheStart))
    },
    [cache]
  )

  const updateCacheOnTransactionApproval = useCallback(
    (transactionId: string, newValue: boolean) => {
      if (cache?.current === undefined) {
        return
      }

      const transactionsByEmployeesKeys = getKeysByCacheStart("transactionsByEmployee@")

      transactionsByEmployeesKeys.forEach((key) => {
        // see if data is cached
        const cachedData = cache.current.get(key)
        if (cachedData) {
          const parsedData = JSON.parse(cachedData)
          const updatedData = parsedData.map((transaction: Transaction) =>
            changeApprovalForId(transactionId, transaction, newValue)
          )
          cache.current.set(key, JSON.stringify(updatedData))
        }
      })

      // Also update paginatedTransactions cache if needed
      const paginatedKeys = getKeysByCacheStart("paginatedTransactions@")

      paginatedKeys.forEach((key) => {
        const cachedData = cache.current.get(key)
        if (cachedData) {
          const parsedData = JSON.parse(cachedData)
          // need rest syntax for pages that may not be affected
          const updatedData = {
            ...parsedData,
            data: parsedData.data.map((transaction: Transaction) =>
              changeApprovalForId(transactionId, transaction, newValue)
            ),
          }
          cache.current.set(key, JSON.stringify(updatedData))
        }
      })

    },
    [cache]
  )

  const fetchWithoutCache = useCallback(
    async <TData, TParams extends object = object>(
      endpoint: RegisteredEndpoints,
      params?: TParams
    ): Promise<TData | null> =>
      wrappedRequest<TData>(async () => {
        const result = await fakeFetch<TData>(endpoint, params)
        return result
      }),
    [wrappedRequest]
  )

  const clearCache = useCallback(() => {
    if (cache?.current === undefined) {
      return
    }

    cache.current = new Map<string, string>()
  }, [cache])

  const clearCacheByEndpoint = useCallback(
    (endpointsToClear: RegisteredEndpoints[]) => {
      if (cache?.current === undefined) {
        return
      }

      const cacheKeys = Array.from(cache.current.keys())

      for (const key of cacheKeys) {
        const clearKey = endpointsToClear.some((endpoint) => key.startsWith(endpoint))

        if (clearKey) {
          cache.current.delete(key)
        }
      }
    },
    [cache]
  )

  return {
    fetchWithCache,
    fetchWithoutCache,
    clearCache,
    clearCacheByEndpoint,
    updateCacheOnTransactionApproval,
    loading,
  }
}

function getCacheKey(endpoint: RegisteredEndpoints, params?: object) {
  return `${endpoint}${params ? `@${JSON.stringify(params)}` : ""}`
}
