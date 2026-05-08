import { google } from "@ai-sdk/google"
import { generateObject, generateText, embedMany } from "ai"
import { z } from "zod"

const MODEL_PRIMARY = "gemini-3-flash-preview"
const MODEL_FALLBACK = "gemini-3.1-flash-lite-preview"
const MODEL_EMBEDDING = "gemini-embedding-2"
const EMBEDDING_PREFIX = "task: clustering | query:"
const OVERLOAD_SIGNALS = ["high demand", "429", "RESOURCE_EXHAUSTED", "quota"]

const primaryModel = google(MODEL_PRIMARY)
const fallbackModel = google(MODEL_FALLBACK)
const embeddingModel = google.textEmbeddingModel(MODEL_EMBEDDING)

async function withFallback<T>(fn: (model: typeof primaryModel) => Promise<T>): Promise<T> {
  try {
    return await fn(primaryModel)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (OVERLOAD_SIGNALS.some((s) => msg.includes(s))) {
      console.warn(`[ai] Primary model overloaded, falling back to ${MODEL_FALLBACK}`)
      return await fn(fallbackModel)
    }
    throw e
  }
}

export async function generateStructured<T>(
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  return withFallback(async (model) => {
    const { object } = await generateObject({ model, prompt, schema })
    return object
  })
}

export async function generate(prompt: string): Promise<string> {
  return withFallback(async (model) => {
    const { text } = await generateText({ model, prompt })
    return text
  })
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const sanitized = texts.map((t) => {
    const clean = t.trim() || "empty"
    return `${EMBEDDING_PREFIX} ${clean}`
  })
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: sanitized,
  })
  return embeddings
}
