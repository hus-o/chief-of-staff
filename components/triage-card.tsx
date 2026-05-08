"use client"

import { useState } from "react"
import { ClusterOutput, FastPathResult, NormalizedMessage, TriageCategory } from "@/lib/types"
import { TriageDropdown } from "./triage-dropdown"
import { ChannelIcon } from "./channel-icon"
import { ArrowBendDownRight, Copy, Check, Flag } from "@phosphor-icons/react"

type Props = {
  item: ClusterOutput | FastPathResult
  messages: NormalizedMessage[]
  effectiveTriage: TriageCategory
  isOverridden: boolean
  isExpanded: boolean
  onToggle: () => void
  onTriageChange: (triage: TriageCategory) => void
}

function isClusterOutput(item: ClusterOutput | FastPathResult): item is ClusterOutput {
  return "clusterId" in item
}

function DraftResponse({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group">
      <div className="pl-4 border-l-2 border-decide/30">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
          Draft response
        </p>
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap max-w-prose">
          {text}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="absolute top-0 right-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-100"
        title="Copy draft"
      >
        {copied ? <Check weight="bold" className="w-3.5 h-3.5 text-green-500" /> : <Copy weight="regular" className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export function TriageCard({ item, messages, effectiveTriage, isOverridden, isExpanded, onToggle, onTriageChange }: Props) {
  const title = item.title
  const why = isClusterOutput(item) ? item.why : item.displayReason
  const flag = item.flag
  const draft = item.draftResponse
  const delegateTo = isClusterOutput(item) ? item.delegateTo : null

  return (
    <div
      className={`rounded-lg border transition-colors duration-100 ${
        isExpanded ? "border-border bg-card" : "border-transparent hover:bg-muted/40"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle() } }}
        className="w-full text-left px-5 py-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-medium leading-snug flex-1 min-w-0">
            {title}
          </h3>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {flag && (
              <Flag
                weight="fill"
                className={`w-3.5 h-3.5 ${
                  flag.severity === "high"
                    ? "text-destructive"
                    : flag.severity === "medium"
                      ? "text-flag-foreground"
                      : "text-muted-foreground"
                }`}
              />
            )}
            <div onClick={(e) => e.stopPropagation()}>
              <TriageDropdown
                current={effectiveTriage}
                isOverridden={isOverridden}
                onChange={onTriageChange}
              />
            </div>
          </div>
        </div>

        {!isExpanded && (
          <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
            {why}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {flag && (
            <span
              className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md ${
                flag.severity === "high"
                  ? "bg-destructive/8 text-destructive"
                  : flag.severity === "medium"
                    ? "bg-flag/10 text-flag-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {flag.reason}
            </span>
          )}

          {delegateTo && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-delegate px-2.5 py-1 rounded-md bg-delegate/10">
              <ArrowBendDownRight weight="bold" className="w-3 h-3" />
              {delegateTo}
            </span>
          )}

          {!isExpanded && messages.length > 1 && (
            <span className="text-[12px] text-muted-foreground/60 font-mono ml-auto">
              {messages.length} messages
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4 mx-5">
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            {why}
          </p>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {messages.length === 1 ? "Message" : `Thread · ${messages.length} messages`}
            </p>

            {messages.map((msg) => (
              <div key={msg.id} className="rounded-lg bg-muted/30 px-4 py-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <ChannelIcon channel={msg.channel} className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[13px] font-medium">{msg.from}</span>
                  <span className="text-[11px] text-muted-foreground font-mono tabular-nums ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {msg.subject && (
                  <p className="text-[13px] font-medium mt-1.5">{msg.subject}</p>
                )}
                <p className="text-[13px] text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {msg.body}
                </p>
              </div>
            ))}
          </div>

          {draft && (
            <DraftResponse text={draft} />
          )}
        </div>
      )}
    </div>
  )
}
