import { z } from "zod"

export const RawMessageSchema = z.object({
  id: z.number(),
  channel: z.string(),
  from: z.string(),
  to: z.string().optional(),
  subject: z.string().optional(),
  channel_name: z.string().optional(),
  timestamp: z.string(),
  body: z.string(),
})

export type RawMessage = z.infer<typeof RawMessageSchema>

// ─── Normalized ──────────────────────────────────────────────────────────────

export type NormalizedMessage = {
  id: string
  channel: string
  from: string
  to: string | null
  subject: string | null
  channelName: string | null
  timestamp: string
  body: string
}

// ─── Stage 1: Fast-Path ──────────────────────────────────────────────────────

export type FastPathCategory =
  | "security_suspicious"
  | "bulk_noise"
  | "personal_nonwork"
  | "obvious_fyi"

export type TriageCategory = "Ignore" | "Delegate" | "Decide"

export type Flag = {
  type: string
  severity: "low" | "medium" | "high"
  reason: string
}

export type FastPathResult = {
  messageId: string
  category: FastPathCategory
  title: string
  triage: TriageCategory
  reason: string
  displayReason: string
  flag: Flag | null
  draftResponse: string | null
}

// ─── Stage 2: Feature Extraction ─────────────────────────────────────────────

export type MessageFeatures = {
  messageId: string
  people: string[]
  topics: string[]
  urgency: "low" | "medium" | "high"
  hasDecisionRequest: boolean
  hasDeadline: boolean
  summary: string
}

// ─── Stage 3: Clustering ─────────────────────────────────────────────────────

export type Cluster = {
  id: string
  messageIds: string[]
}

// ─── Stage 4: Cluster Synthesis ──────────────────────────────────────────────

export type ClusterOutput = {
  clusterId: string
  title: string
  triage: TriageCategory
  why: string
  flag: Flag | null
  delegateTo: string | null
  draftResponse: string
  messageIds: string[]
  rejectedMessageIds: string[]
}

// ─── Stage 5: Briefing ──────────────────────────────────────────────────────

export type DailyBriefing = {
  urgentDecisions: string[]
  importantUpdates: string[]
  flagsAndRisks: string[]
  delegatedItems: string[]
  fullText: string
}

// ─── Final API Response ──────────────────────────────────────────────────────

export type AnalysisResult = {
  fastPathResults: FastPathResult[]
  clusterOutputs: ClusterOutput[]
  briefing: DailyBriefing
  processingTimeMs: number
}

export const PersistedStateSchema = z.object({
  result: z.object({
    fastPathResults: z.array(z.any()),
    clusterOutputs: z.array(z.any()),
    briefing: z.object({
      urgentDecisions: z.array(z.string()),
      importantUpdates: z.array(z.string()),
      flagsAndRisks: z.array(z.string()),
      delegatedItems: z.array(z.string()),
      fullText: z.string(),
    }),
    processingTimeMs: z.number(),
  }),
  messages: z.array(z.object({
    id: z.string(),
  channel: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    subject: z.string().nullable(),
    channelName: z.string().nullable(),
    timestamp: z.string(),
    body: z.string(),
  })),
  overrides: z.record(z.string(), z.enum(["Ignore", "Delegate", "Decide"])),
})
