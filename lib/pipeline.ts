import { RawMessage, AnalysisResult } from "./types"
import { normalizeMessages } from "./normalize"
import { runFastPathDetectors } from "./fast-path"
import { extractFeatures } from "./extract-features"
import { embedAndCluster } from "./clustering"
import { synthesizeClusters, BatchContext } from "./synthesis"
import { generateDailyBriefing } from "./briefing"

export async function analyzeMessages(raw: RawMessage[]): Promise<AnalysisResult> {
  const start = Date.now()
  const normalized = normalizeMessages(raw)

  const { fastPathResults, businessQueue } = runFastPathDetectors(normalized)

  if (businessQueue.length === 0) {
    return {
      fastPathResults,
      clusterOutputs: [],
      briefing: {
        urgentDecisions: [],
        importantUpdates: [],
        flagsAndRisks: [],
        delegatedItems: [],
        fullText: "No business messages requiring attention today.",
      },
      processingTimeMs: Date.now() - start,
    }
  }

  const featureMap = await extractFeatures(businessQueue)

  const batchContext: BatchContext = businessQueue
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((m) => ({
      id: m.id,
      from: m.from,
      time: new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      summary: featureMap.get(m.id)?.summary ?? m.body.slice(0, 100),
    }))

  const { clusters } = await embedAndCluster(businessQueue, featureMap)

  const clusterOutputs = await synthesizeClusters(clusters, normalized, featureMap, batchContext)

  const briefing = await generateDailyBriefing(clusterOutputs, fastPathResults)

  return {
    fastPathResults,
    clusterOutputs,
    briefing,
    processingTimeMs: Date.now() - start,
  }
}
