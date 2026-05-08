import { readFile } from "fs/promises"
import path from "path"

export async function GET() {
  let messages: unknown[]
  try {
    const filePath = path.join(process.cwd(), "public", "sample", "messages.json")
    const raw = await readFile(filePath, "utf-8")
    messages = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: "Sample data unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  let cancelled = false
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < messages.length; i++) {
        if (cancelled) return
        const data = JSON.stringify(messages[i])
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 400))
      }
      if (!cancelled) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      }
    },
    cancel() {
      cancelled = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  })
}
