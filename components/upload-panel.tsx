"use client"

import { useRef } from "react"
import { z } from "zod"
import { RawMessage, RawMessageSchema } from "@/lib/types"
import { Button } from "@/components/ui/button"

type Props = {
  onUpload: (messages: RawMessage[]) => void
  onStartIngestion: () => void
}

export function UploadPanel({ onUpload, onStartIngestion }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const json = JSON.parse(text)
      const parsed = z.array(RawMessageSchema).safeParse(json)
      if (!parsed.success) {
        alert("Invalid message format")
        return
      }
      onUpload(parsed.data)
    } catch {
      alert("Invalid JSON file")
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Good morning</h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            Sync your overnight messages or upload a batch to get your daily briefing.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={onStartIngestion}
            className="w-full h-10"
          >
            Sync messages
          </Button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-10 text-[14px] text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            or upload a JSON file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}
