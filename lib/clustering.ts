import { NormalizedMessage, MessageFeatures, Cluster } from "./types"
import { embedTexts } from "./ai"

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function buildEmbeddingText(msg: NormalizedMessage, features: MessageFeatures | undefined): string {
  const parts: string[] = []
  if (msg.subject) parts.push(msg.subject)
  parts.push(msg.body)
  if (features) {
    if (features.topics.length) parts.push(`Topics: ${features.topics.join(", ")}`)
    parts.push(`Summary: ${features.summary}`)
  }
  return parts.join("\n")
}

const simKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`

function agglomerativeCluster(
  ids: string[],
  simMatrix: Map<string, number>,
  threshold: number
): string[][] {
  let clusters: string[][] = ids.map((id) => [id])

  function clusterSimilarity(clA: string[], clB: string[]): number {
    let min = Infinity
    for (const a of clA) {
      for (const b of clB) {
        const sim = simMatrix.get(simKey(a, b)) ?? 0
        if (sim < min) min = sim
      }
    }
    return min
  }

  while (clusters.length > 1) {
    let bestSim = -Infinity
    let bestI = -1
    let bestJ = -1

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const sim = clusterSimilarity(clusters[i], clusters[j])
        if (sim > bestSim) {
          bestSim = sim
          bestI = i
          bestJ = j
        }
      }
    }

    if (bestSim < threshold) break

    clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]]
    clusters.splice(bestJ, 1)
  }

  return clusters
}

export async function embedAndCluster(
  messages: NormalizedMessage[],
  featureMap: Map<string, MessageFeatures>
): Promise<{ clusters: Cluster[] }> {
  if (messages.length === 0) {
    return { clusters: [] }
  }

  if (messages.length === 1) {
    return { clusters: [{ id: "cluster-1", messageIds: [messages[0].id] }] }
  }

  const ids = messages.map((m) => m.id)
  const texts = messages.map((m) => buildEmbeddingText(m, featureMap.get(m.id)))

  const vectors = await embedTexts(texts)

  const simMatrix = new Map<string, number>()
  const allSims: number[] = []

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j])
      simMatrix.set(simKey(ids[i], ids[j]), sim)
      allSims.push(sim)
    }
  }

  const mean = allSims.reduce((a, b) => a + b, 0) / allSims.length
  const variance = allSims.reduce((a, b) => a + (b - mean) ** 2, 0) / allSims.length
  const stddev = Math.sqrt(variance)

  const STDDEV_MULTIPLIER = 1.5
  const THRESHOLD_FLOOR = 0.75
  const threshold = Math.max(mean + STDDEV_MULTIPLIER * stddev, THRESHOLD_FLOOR)

  const rawClusters = agglomerativeCluster(ids, simMatrix, threshold)

  const clusters: Cluster[] = rawClusters.map((memberIds, idx) => ({
    id: `cluster-${idx + 1}`,
    messageIds: memberIds,
  }))

  return { clusters }
}
