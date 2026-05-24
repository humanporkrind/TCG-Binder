import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import AppShell from '@/components/ui/AppShell'
import BinderView from '@/views/BinderView'
import AnalyticsView from '@/views/AnalyticsView'
import ImportExportView from '@/views/ImportExportView'
import type { Binder, Card, CardPrice, OwnedCard, CardSet } from '@/types'

export default function App(): JSX.Element {
  const {
    view, activeBinder,
    setBinders, setActiveBinder, setCards, setOwned, setSets, setLoading,
    setPrices, setPriceStatus, setPriceProgress
  } = useStore()

  const [forceRefreshKey, setForceRefreshKey] = useState(0)
  const prevRefreshKeyRef = useRef(0)

  // Load all binders on startup
  useEffect(() => {
    async function init(): Promise<void> {
      const binders = await window.electronAPI.getAllBinders() as Binder[]
      setBinders(binders)
      if (binders.length > 0) setActiveBinder(binders[0])
      else setLoading(false)
    }
    init()
  }, [setBinders, setActiveBinder, setLoading])

  // Reload cards/owned/sets whenever the active binder changes
  useEffect(() => {
    if (!activeBinder) return
    let cancelled = false

    async function loadBinder(): Promise<void> {
      setLoading(true)
      try {
        const [cards, owned, sets] = await Promise.all([
          window.electronAPI.getAllCards(activeBinder!.id) as Promise<Card[]>,
          window.electronAPI.getAllOwned(activeBinder!.id) as Promise<OwnedCard[]>,
          window.electronAPI.getAllSets(activeBinder!.id) as Promise<CardSet[]>
        ])
        if (!cancelled) {
          setCards(cards)
          setOwned(owned)
          setSets(sets)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadBinder()
    return () => { cancelled = true }
  }, [activeBinder?.id, setCards, setOwned, setSets, setLoading])

  // Background price fetch whenever binder changes (at most once per week, or on manual refresh)
  useEffect(() => {
    if (!activeBinder) return
    let cancelled = false

    const isManualRefresh = forceRefreshKey !== prevRefreshKeyRef.current
    prevRefreshKeyRef.current = forceRefreshKey

    async function maybeRefreshPrices(): Promise<void> {
      const list = await window.electronAPI.getPricesForBinder(activeBinder!.id)
      if (cancelled) return

      const priceList = list as CardPrice[]
      setPrices(priceList)

      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
      const needsRefresh =
        isManualRefresh ||
        priceList.length === 0 ||
        Math.max(...priceList.map((p) => new Date(p.fetched_at).getTime())) < Date.now() - SEVEN_DAYS

      if (!needsRefresh) {
        setPriceStatus('done')
        return
      }

      setPriceStatus('fetching')
      setPriceProgress({ processed: 0, total: 1 })

      window.electronAPI.onPricesProgress((raw) => {
        const data = raw as { processed: number; total: number }
        setPriceProgress({ processed: data.processed, total: data.total })
      })
      window.electronAPI.onPricesDone(() => {
        setPriceStatus('done')
        setPriceProgress(null)
        Promise.all([
          window.electronAPI.getPricesForBinder(activeBinder!.id),
          window.electronAPI.getAllCards(activeBinder!.id)
        ]).then(([prices, cards]) => {
          setPrices(prices as CardPrice[])
          setCards(cards as Card[])
        })
      })

      window.electronAPI.fetchPrices(activeBinder!.id)
    }

    maybeRefreshPrices()

    return () => {
      cancelled = true
      window.electronAPI.offPricesProgress()
      window.electronAPI.offPricesDone()
    }
  }, [activeBinder?.id, forceRefreshKey, setPrices, setPriceStatus, setPriceProgress, setCards])

  return (
    <AppShell onRefreshPrices={() => setForceRefreshKey((k) => k + 1)}>
      {view === 'binder' && <BinderView />}
      {view === 'analytics' && <AnalyticsView />}
      {view === 'import-export' && <ImportExportView />}
    </AppShell>
  )
}
