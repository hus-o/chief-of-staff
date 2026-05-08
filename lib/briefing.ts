import { ClusterOutput, FastPathResult, DailyBriefing } from "./types"
import { generate } from "./ai"

function buildBriefingPrompt(
  clusterOutputs: ClusterOutput[],
  fastPathResults: FastPathResult[]
): string {
  // Pre-categorize items by triage level
  const decideItems = clusterOutputs.filter((c) => c.triage === "Decide")
  const delegateItems = clusterOutputs.filter((c) => c.triage === "Delegate" && c.delegateTo)
  const ignoreItems = clusterOutputs.filter((c) => c.triage === "Ignore")

  // Collect ALL flagged items across every category
  const flaggedItems = [
    ...clusterOutputs.filter((c) => c.flag).map((c) => ({
      title: c.title,
      flag: c.flag!,
      triage: c.triage,
    })),
    ...fastPathResults.filter((f) => f.flag).map((f) => ({
      title: f.title,
      flag: f.flag!,
      triage: f.triage,
    })),
  ]

  const formatItem = (c: ClusterOutput) =>
    `- ${c.title}: ${c.why}${c.flag ? ` [FLAG: ${c.flag.severity} — ${c.flag.reason}]` : ""}`

  const sections: string[] = []

  sections.push("DECIDE ITEMS (CEO must personally act):")
  if (decideItems.length > 0) {
    sections.push(decideItems.map(formatItem).join("\n"))
  } else {
    sections.push("  (none)")
  }

  sections.push("\nDELEGATE ITEMS (action needed, assigned to someone):")
  if (delegateItems.length > 0) {
    sections.push(
      delegateItems
        .map((c) => `- ${c.title}: ${c.why} → Delegate to: ${c.delegateTo}`)
        .join("\n")
    )
  } else {
    sections.push("  (none)")
  }

  sections.push("\nFLAGGED ITEMS (CEO should be aware, any triage level):")
  if (flaggedItems.length > 0) {
    sections.push(
      flaggedItems
        .map((f) => `- [${f.flag.severity.toUpperCase()}] ${f.title}: ${f.flag.reason} (triage: ${f.triage})`)
        .join("\n")
    )
  } else {
    sections.push("  (none)")
  }

  sections.push("\nIGNORE ITEMS (informational updates, no action):")
  if (ignoreItems.length > 0) {
    sections.push(ignoreItems.map((c) => `- ${c.title}: ${c.why}`).join("\n"))
  } else {
    sections.push("  (none)")
  }

  return `Write a daily executive briefing for a CEO. It must be readable in under 2 minutes.

Today's triaged items:

${sections.join("\n")}

BRIEFING STRUCTURE (use this exact structure every time):

## Urgent Decisions
Bullet points from DECIDE items ONLY. Lead with the most time-sensitive. If none, write "No urgent decisions today."

## Flags & Risks
Bullet points from FLAGGED ITEMS above — include ALL flagged items regardless of their triage category. Security alerts, project risks, delays, noteworthy developments.

## Key Updates
Bullet points summarising noteworthy developments from IGNORE items. These are things the CEO should know happened, even though no action is needed.

## Delegated
Bullet points from DELEGATE items ONLY — who is handling what. If there are NO delegate items, OMIT THIS SECTION ENTIRELY. Do NOT invent delegations from Ignore items.

RULES:
- Concise bullet points, professional executive tone
- Lead each section with the most important/urgent item
- Do NOT repeat the same item across sections
- Do NOT fabricate information not present in the triaged items
- The "Delegated" section must ONLY contain items where triage is "Delegate" and a specific person is assigned. If no such items exist, do not include this section.`
}

function extractSection(text: string, heading: string): string[] {
  const regex = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=##|$)`, "i")
  const match = text.match(regex)
  if (!match) return []

  return match[0]
    .split("\n")
    .filter((line) => line.trim().startsWith("-") || line.trim().startsWith("•") || line.trim().startsWith("*"))
    .map((line) => line.replace(/^[\s\-•*]+/, "").trim())
    .filter(Boolean)
}

export async function generateDailyBriefing(
  clusterOutputs: ClusterOutput[],
  fastPathResults: FastPathResult[]
): Promise<DailyBriefing> {
  const prompt = buildBriefingPrompt(clusterOutputs, fastPathResults)
  const fullText = await generate(prompt)

  return {
    urgentDecisions: extractSection(fullText, "Urgent Decisions"),
    importantUpdates: extractSection(fullText, "Key Updates"),
    flagsAndRisks: extractSection(fullText, "Flags & Risks"),
    delegatedItems: extractSection(fullText, "Delegated"),
    fullText,
  }
}
