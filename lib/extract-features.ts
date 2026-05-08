import { z } from "zod"
import { NormalizedMessage, MessageFeatures } from "./types"
import { generateStructured } from "./ai"
import { withConcurrency } from "./concurrency"

const messageFeaturesSchema = z.array(
  z.object({
    messageId: z.string(),
    people: z.array(z.string()),
    topics: z.array(z.string()),
    urgency: z.enum(["low", "medium", "high"]),
    hasDecisionRequest: z.boolean(),
    hasDeadline: z.boolean(),
    summary: z.string(),
  })
)

function buildExtractionPrompt(messages: NormalizedMessage[]): string {
  const messageList = messages
    .map(
      (m) =>
        `[ID: ${m.id}] Channel: ${m.channel} | From: ${m.from}${m.subject ? ` | Subject: ${m.subject}` : ""}\nBody: ${m.body}`
    )
    .join("\n\n---\n\n")

  return `You are extracting structured features from business communications for an executive assistant system.

For EACH message below, return a JSON object with:
- messageId: string (the ID provided)
- people: string[] (people mentioned by name — e.g. "Sarah Chen", "Tom Bradley")
- topics: string[] (company names, project names, deal names, product names — NOT people)
- urgency: "low" | "medium" | "high"
- hasDecisionRequest: boolean (does this message explicitly ask someone to make a decision or choose between options?)
- hasDeadline: boolean (is there an explicit deadline or time constraint?)
- summary: string (1-2 sentence factual summary — WHO is asking WHAT of WHOM)

Rules:
- Analyze each message independently
- urgency: "high" = explicit time pressure or production issue; "medium" = needs attention soon; "low" = informational
- hasDecisionRequest: only true if sender explicitly asks for a choice/decision
- summary: factual and concise

Return a JSON array of objects, one per message, in the same order.

Messages:

${messageList}`
}

export async function extractFeatures(
  messages: NormalizedMessage[]
): Promise<Map<string, MessageFeatures>> {
  const featureMap = new Map<string, MessageFeatures>()
  const BATCH_SIZE = 20
  const CONCURRENCY = 5

  const batches: NormalizedMessage[][] = []
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    batches.push(messages.slice(i, i + BATCH_SIZE))
  }

  const results = await withConcurrency(
    CONCURRENCY,
    batches.map((batch) => () => generateStructured(buildExtractionPrompt(batch), messageFeaturesSchema))
  )

  for (const batchResult of results) {
    for (const feat of batchResult) {
      featureMap.set(feat.messageId, feat)
    }
  }

  return featureMap
}
