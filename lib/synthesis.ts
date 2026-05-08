import { z } from "zod"
import { NormalizedMessage, MessageFeatures, Cluster, ClusterOutput } from "./types"
import { generateStructured } from "./ai"
import { withConcurrency } from "./concurrency"

function stripInternalRefs(text: string): string {
  return text.replace(/\s*\(msg\s*\d+\)/gi, "").trim()
}

export type BatchContext = {
  id: string
  from: string
  time: string
  summary: string
}[]

const synthesisSchema = z.object({
  title: z.string(),
  triage: z.enum(["Ignore", "Delegate", "Decide"]),
  why: z.string(),
  flag: z
    .object({
      type: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      reason: z.string(),
    })
    .nullable(),
  delegateTo: z.string().nullable(),
  draftResponse: z.string(),
  rejectedMessageIds: z.array(z.string()),
})

function formatBatchContext(ctx: BatchContext): string {
  return ctx
    .map((c) => `  [${c.id}] ${c.time} — ${c.from}: ${c.summary}`)
    .join("\n")
}

function formatMessages(messages: NormalizedMessage[], features: MessageFeatures[]): string {
  return messages
    .map((m) => {
      const feat = features.find((f) => f.messageId === m.id)
      return `[ID: ${m.id}] Channel: ${m.channel} | From: ${m.from} | Time: ${m.timestamp}${m.subject ? `\nSubject: ${m.subject}` : ""}
Body: ${m.body}
Extracted: urgency=${feat?.urgency ?? "unknown"}, decisionRequested=${feat?.hasDecisionRequest ?? false}, summary="${feat?.summary ?? ""}"`
    })
    .join("\n\n---\n\n")
}

function buildSynthesisPrompt(
  messages: NormalizedMessage[],
  features: MessageFeatures[],
  batchContext: BatchContext
): string {
  const messageList = formatMessages(messages, features)

  return `You are an executive assistant analyzing a group of related business messages for a CEO.

FULL BATCH CONTEXT (all messages received this morning, chronological):
${formatBatchContext(batchContext)}

Use this context to understand how situations evolved. For example, if someone sent a request and later reversed it in a different message, account for that.

---

YOUR GROUP TO ANALYZE:

${messageList}

---

Your job:
1. VERIFY the grouping — if any message clearly does NOT belong with the others, list its ID in rejectedMessageIds
2. Determine the appropriate triage category
3. Explain WHY concisely, referencing how the thread evolved (not just the topic)
4. Draft a response if action is needed
5. Determine if the CEO should be flagged/made aware of this item

TRIAGE CATEGORIES:
- "Decide": The CEO must personally act (material business risk, revenue impact, executive scheduling conflict, urgent production tradeoff, sign-off required)
- "Delegate": Action is needed, nobody is currently handling it, and it's not the CEO's job. Specify who in delegateTo.
- "Ignore": No CEO action needed (informational, already resolved, already being handled by the right person)

IMPORTANT — do NOT confuse "Delegate" with "someone is already handling it." If someone is already on it, that's "Ignore." Delegate means action is needed but has no owner yet.

FLAG GUIDANCE:
Flag is INDEPENDENT of triage category. Set a flag for ANY item the CEO should be aware of, even "Ignore" items. Examples:
- An "Ignore" project update that's noteworthy → flag it (severity: "low")
- An "Ignore" item where someone is managing a delay → flag it (severity: "medium")  
- A "Decide" production outage → flag it (severity: "high")
Only set flag to null for truly unremarkable items (e.g., a meeting logistics confirmation).

For the "why" field — speak directly to the CEO, reference context naturally, NEVER include internal message IDs like "(msg 3)":
BAD: "James initially requested a postponement (msg 3) but later reversed this decision — no CEO action needed."
GOOD: "James initially requested a postponement but later reversed this decision — no action needed from you."

For draftResponse:
- Decide: draft what the CEO should say/decide
- Delegate: draft a handoff message to the responsible person
- Ignore: brief note or empty string`
}

export async function synthesizeClusters(
  clusters: Cluster[],
  messages: NormalizedMessage[],
  featureMap: Map<string, MessageFeatures>,
  batchContext: BatchContext
): Promise<ClusterOutput[]> {
  const CONCURRENCY = 10

  const outputs = await withConcurrency(
    CONCURRENCY,
    clusters.map((cluster) => async () => {
        const clusterMessages = cluster.messageIds
          .map((id) => messages.find((m) => m.id === id))
          .filter((m): m is NormalizedMessage => m !== undefined)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        const clusterFeatures = cluster.messageIds
          .map((id) => featureMap.get(id))
          .filter((f): f is MessageFeatures => f !== undefined)

        const prompt = buildSynthesisPrompt(clusterMessages, clusterFeatures, batchContext)
        const result = await generateStructured(prompt, synthesisSchema)

        return {
          clusterId: cluster.id,
          title: result.title,
          triage: result.triage,
          why: stripInternalRefs(result.why),
          flag: result.flag,
          delegateTo: result.delegateTo,
          draftResponse: result.draftResponse,
          messageIds: cluster.messageIds.filter(
            (id) => !result.rejectedMessageIds.includes(id)
          ),
          rejectedMessageIds: result.rejectedMessageIds,
        }
    })
  )

  // Re-process rejected messages in a single batched call
  const allRejected = outputs.flatMap((o) => o.rejectedMessageIds)
  if (allRejected.length > 0) {
    const singletonOutputs = await batchSynthesizeSingletons(allRejected, messages, featureMap, batchContext)
    outputs.push(...singletonOutputs)
  }

  return outputs
}

const batchSingletonSchema = z.object({
  results: z.array(
    z.object({
      messageId: z.string(),
      title: z.string(),
      triage: z.enum(["Ignore", "Delegate", "Decide"]),
      why: z.string(),
      flag: z
        .object({
          type: z.string(),
          severity: z.enum(["low", "medium", "high"]),
          reason: z.string(),
        })
        .nullable(),
      delegateTo: z.string().nullable(),
      draftResponse: z.string(),
    })
  ),
})

function buildBatchSingletonPrompt(
  messages: NormalizedMessage[],
  features: MessageFeatures[],
  batchContext: BatchContext
): string {
  const messageList = formatMessages(messages, features)

  return `You are an executive assistant triaging individual business messages for a CEO.

FULL BATCH CONTEXT (all messages received this morning, chronological):
${formatBatchContext(batchContext)}

Use this context to understand how situations evolved. If a message has been superseded or resolved by a later message, account for that.

---

Each message below is independent (not part of a group). For EACH message, determine:
1. Triage category
2. A short title
3. A concise "why" explaining the triage decision — speak directly to the CEO, never reference internal message IDs like "(msg 3)"
4. Any flag the CEO should know about
5. Who to delegate to (or null)
6. A draft response if action is needed

TRIAGE CATEGORIES:
- "Decide": CEO must personally act
- "Delegate": Action is needed, nobody is currently handling it, and it's not the CEO's job. Specify who.
- "Ignore": No CEO action needed (informational, already resolved, already being handled)

FLAG: Set a flag for any item the CEO should be aware of, even "Ignore" items. Only null for truly unremarkable items.

Messages:

${messageList}`
}

async function batchSynthesizeSingletons(
  rejectedIds: string[],
  allMessages: NormalizedMessage[],
  featureMap: Map<string, MessageFeatures>,
  batchContext: BatchContext
): Promise<ClusterOutput[]> {
  const msgs = rejectedIds
    .map((id) => allMessages.find((m) => m.id === id))
    .filter((m): m is NormalizedMessage => m !== undefined)

  const features = rejectedIds
    .map((id) => featureMap.get(id))
    .filter((f): f is MessageFeatures => f !== undefined)

  const prompt = buildBatchSingletonPrompt(msgs, features, batchContext)
  const { results } = await generateStructured(prompt, batchSingletonSchema)

  return results.map((r, idx) => ({
    clusterId: `singleton-${idx + 1}`,
    title: r.title,
    triage: r.triage,
    why: stripInternalRefs(r.why),
    flag: r.flag,
    delegateTo: r.delegateTo,
    draftResponse: r.draftResponse,
    messageIds: [r.messageId],
    rejectedMessageIds: [],
  }))
}
