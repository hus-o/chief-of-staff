"use client"

import { useState, useMemo } from "react"
import { RawMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ChannelIcon } from "./channel-icon"

type Props = {
  messages: RawMessage[]
  isIngesting: boolean
  onRunAnalysis: () => void
}

export function PendingQueue({ messages, isIngesting, onRunAnalysis }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const reversed = useMemo(() => messages.toReversed(), [messages])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          {isIngesting && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
          <span className="text-[13px] text-muted-foreground">
            {isIngesting ? "Receiving" : "Ready"}{" "}
            <span className="font-mono text-foreground">{messages.length}</span>{" "}
            {messages.length === 1 ? "message" : "messages"}
            <span className="ml-2 text-[11px] text-muted-foreground/60 font-medium">(Simulated Demo)</span>
          </span>
        </div>
        <Button
          size="sm"
          onClick={onRunAnalysis}
          disabled={isIngesting || messages.length === 0}
        >
          Run analysis
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border/40">
          {reversed.map((msg) => {
            const isExpanded = expandedId === msg.id
            return (
              <article
                key={msg.id}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(isExpanded ? null : msg.id) } }}
                className="px-6 py-3 cursor-pointer hover:bg-muted/30 transition-colors duration-100"
              >
                <div className="flex items-start gap-4">
                  <span className="text-muted-foreground shrink-0 pt-0.5">
                    <ChannelIcon channel={msg.channel} className="w-4 h-4" />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[14px] font-medium truncate">{msg.from}</span>
                      {msg.subject && (
                        <span className="text-[14px] text-muted-foreground truncate">
                          {msg.subject}
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <p className="text-[13px] text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                        {msg.body}
                      </p>
                    ) : (
                      <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">
                        {msg.body}
                      </p>
                    )}
                  </div>

                  <time className="text-[12px] text-muted-foreground font-mono tabular-nums shrink-0 pt-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
