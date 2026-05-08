"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { AnalysisResult, NormalizedMessage, RawMessage, TriageCategory, PersistedStateSchema } from "@/lib/types"
import { normalizeMessages } from "@/lib/normalize"
import { UploadPanel } from "@/components/upload-panel"
import { TriageList } from "@/components/triage-list"
import { ProgressIndicator } from "@/components/progress-indicator"
import { PendingQueue } from "@/components/pending-queue"
import dynamic from "next/dynamic"

const BriefingPanel = dynamic(() => import("@/components/briefing-panel").then((m) => m.BriefingPanel), { ssr: false })

type AppState = "empty" | "ingesting" | "pending" | "analyzing" | "results"

const STORAGE_KEY = "cos-state:v1"

type PersistedState = {
  result: AnalysisResult
  messages: NormalizedMessage[]
  overrides: Record<string, TriageCategory>
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = PersistedStateSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed.data as PersistedState
  } catch {
    return null
  }
}

function persistState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // noop
  }
}

function clearPersistedState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("empty")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [messages, setMessages] = useState<NormalizedMessage[]>([])
  const [pendingMessages, setPendingMessages] = useState<RawMessage[]>([])
  const [overrides, setOverrides] = useState<Record<string, TriageCategory>>({})
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const saved = loadPersistedState()
    if (saved) {
      setResult(saved.result)
      setMessages(saved.messages)
      setOverrides(saved.overrides)
      setAppState("results")
    }
  }, [])

  useEffect(() => {
    if (result && messages.length > 0) {
      persistState({ result, messages, overrides })
    }
  }, [result, messages, overrides])

  const handleOverride = useCallback((itemId: string, triage: TriageCategory) => {
    setOverrides((prev) => ({ ...prev, [itemId]: triage }))
  }, [])

  const startIngestion = useCallback(async () => {
    setAppState("ingesting")
    setPendingMessages([])
    setResult(null)
    setError(null)
    setOverrides({})

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/ingest/stream", {
        signal: abortRef.current.signal,
      })
      if (!res.body) throw new Error("No response body")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const data = line.replace(/^data: /, "").trim()
          if (!data || data === "[DONE]") {
            if (data === "[DONE]") {
              setAppState("pending")
            }
            continue
          }
          try {
            const msg = JSON.parse(data) as RawMessage
            setPendingMessages((prev) => [...prev, msg])
          } catch {
            // skip malformed
          }
        }
      }

      setAppState("pending")
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Ingestion failed")
        setAppState("empty")
      }
    }
  }, [])

  const analyze = async (rawMessages: RawMessage[]) => {
    setAppState("analyzing")
    setError(null)
    setOverrides({})

    const normalized = normalizeMessages(rawMessages)
    setMessages(normalized)

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rawMessages),
      })

      if (!res.ok) {
        const text = await res.text()
        try {
          const err = JSON.parse(text)
          throw new Error(err.error || "Analysis failed")
        } catch {
          throw new Error("Analysis failed")
        }
      }

      const data: AnalysisResult = await res.json()
      setResult(data)
      setAppState("results")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
      setAppState("pending")
    }
  }

  const handleRunAnalysis = useCallback(() => {
    analyze(pendingMessages)
  }, [pendingMessages])

  const handleUpload = useCallback((rawMessages: RawMessage[]) => {
    setPendingMessages(rawMessages)
    setAppState("pending")
  }, [])

  const handleReset = useCallback(() => {
    abortRef.current?.abort()
    setAppState("empty")
    setResult(null)
    setMessages([])
    setPendingMessages([])
    setOverrides({})
    setError(null)
    clearPersistedState()
  }, [])

  return (
    <main className="h-screen flex flex-col">
      <header className="border-b border-border/60 px-6 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-[16px] font-semibold tracking-tight">Chief of Staff</h1>
        {appState !== "empty" && (
          <button
            onClick={handleReset}
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground border border-border/60 rounded-md px-3 py-1.5 transition-colors duration-100 hover:bg-muted/40"
          >
            New analysis
          </button>
        )}
      </header>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 border border-destructive/20 rounded-md text-sm text-destructive bg-destructive/5">
          {error}
        </div>
      )}

      {appState === "empty" && (
        <UploadPanel
          onUpload={handleUpload}
          onStartIngestion={startIngestion}
        />
      )}

      {(appState === "ingesting" || appState === "pending") && (
        <PendingQueue
          messages={pendingMessages}
          isIngesting={appState === "ingesting"}
          onRunAnalysis={handleRunAnalysis}
        />
      )}

      {appState === "analyzing" && (
        <div className="flex-1 flex items-center justify-center">
          <ProgressIndicator />
        </div>
      )}

      {appState === "results" && result && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[55%] border-r border-border/60 overflow-hidden flex flex-col">
            <TriageList
              result={result}
              messages={messages}
              overrides={overrides}
              onOverride={handleOverride}
            />
          </div>
          <div className="w-[45%] overflow-hidden flex flex-col">
            <BriefingPanel briefing={result.briefing} />
          </div>
        </div>
      )}
    </main>
  )
}
