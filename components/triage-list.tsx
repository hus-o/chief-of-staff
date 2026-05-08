"use client"

import { useState, useMemo, useCallback } from "react"
import { AnalysisResult, NormalizedMessage, TriageCategory, ClusterOutput, FastPathResult } from "@/lib/types"
import { TriageCard } from "./triage-card"

type Props = {
  result: AnalysisResult
  messages: NormalizedMessage[]
  overrides: Record<string, TriageCategory>
  onOverride: (itemId: string, triage: TriageCategory) => void
}

type TriageItem = {
  type: "cluster" | "fastpath"
  item: ClusterOutput | FastPathResult
  triage: TriageCategory
  itemId: string
}

const tabs = [
  { key: "all", label: "All" },
  { key: "Decide", label: "Decide" },
  { key: "Delegate", label: "Delegate" },
  { key: "Ignore", label: "Ignore" },
  { key: "flags", label: "Flags" },
] as const

type TabKey = (typeof tabs)[number]["key"]

const SORT_ORDER: Record<TriageCategory, number> = { Decide: 0, Delegate: 1, Ignore: 2 }

function severityRank(item: ClusterOutput | FastPathResult): number {
  if (!item.flag) return 3
  if (item.flag.severity === "high") return 0
  if (item.flag.severity === "medium") return 1
  return 2
}

export function TriageList({ result, messages, overrides, onOverride }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const messageMap = useMemo(() => {
    const map = new Map<string, NormalizedMessage>()
    for (const m of messages) map.set(m.id, m)
    return map
  }, [messages])

  const { sorted, counts } = useMemo(() => {
    const allItems: TriageItem[] = [
      ...result.clusterOutputs.map((c) => ({
        type: "cluster" as const,
        item: c,
        triage: overrides[c.clusterId] ?? c.triage,
        itemId: c.clusterId,
      })),
      ...result.fastPathResults.map((f) => ({
        type: "fastpath" as const,
        item: f,
        triage: overrides[f.messageId] ?? f.triage,
        itemId: f.messageId,
      })),
    ]

    const sorted = allItems.toSorted((a, b) => {
      const triageDiff = SORT_ORDER[a.triage] - SORT_ORDER[b.triage]
      if (triageDiff !== 0) return triageDiff
      return severityRank(a.item) - severityRank(b.item)
    })

    const counts: Record<TabKey, number> = {
      all: allItems.length,
      Decide: 0,
      Delegate: 0,
      Ignore: 0,
      flags: 0,
    }
    for (const item of allItems) {
      counts[item.triage]++
      if (item.item.flag) counts.flags++
    }

    return { sorted, counts }
  }, [result, overrides])

  const filtered = useMemo(() => {
    if (activeTab === "all") return sorted
    if (activeTab === "flags") return sorted.filter((i) => i.item.flag !== null)
    return sorted.filter((i) => i.triage === activeTab)
  }, [sorted, activeTab])

  const getMessages = useCallback(
    (entry: TriageItem): NormalizedMessage[] => {
      const ids = "clusterId" in entry.item
        ? entry.item.messageIds
        : [entry.item.messageId]
      return ids
        .map((id) => messageMap.get(id))
        .filter((m): m is NormalizedMessage => m !== undefined)
    },
    [messageMap]
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-1.5 px-5 pt-4 pb-3 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors duration-100
              ${
                activeTab === tab.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }
            `}
          >
            {tab.label}
            <span className="ml-1.5 font-mono text-[12px]">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {filtered.map((entry) => (
            <TriageCard
              key={entry.itemId}
              item={entry.item}
              messages={getMessages(entry)}
              effectiveTriage={entry.triage}
              isOverridden={entry.itemId in overrides}
              isExpanded={expandedId === entry.itemId}
              onToggle={() => setExpandedId(expandedId === entry.itemId ? null : entry.itemId)}
              onTriageChange={(t) => onOverride(entry.itemId, t)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-[14px] text-muted-foreground text-center py-16">
              No items in this category.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
