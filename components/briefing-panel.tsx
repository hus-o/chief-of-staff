"use client"

import { useMemo } from "react"
import { DailyBriefing } from "@/lib/types"
import ReactMarkdown from "react-markdown"

type Props = {
  briefing: DailyBriefing
}

export function BriefingPanel({ briefing }: Props) {
  const cleaned = useMemo(
    () =>
      briefing.fullText
        .replace(/^#+\s*Executive Briefing\s*\n?/im, "")
        .replace(/^\*?\*?Date:\*?\*?\s*.+\n?/im, "")
        .replace(/^\*?\*?Read Time:\*?\*?\s*.+\n?/im, "")
        .trim(),
    [briefing.fullText]
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 py-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground mb-5">
          Daily Briefing
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-[15px] prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-6 prose-headings:mb-2 prose-p:text-[14px] prose-p:leading-relaxed prose-li:text-[14px] prose-li:leading-relaxed prose-ul:my-2 prose-li:my-0.5 prose-strong:font-semibold">
          <ReactMarkdown>{cleaned}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
