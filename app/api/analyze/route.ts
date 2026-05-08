import { NextRequest, NextResponse } from "next/server"
import { analyzeMessages } from "@/lib/pipeline"
import { RawMessageSchema } from "@/lib/types"
import { z } from "zod"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = z.array(RawMessageSchema).safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const result = await analyzeMessages(parsed.data)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    )
  }
}
