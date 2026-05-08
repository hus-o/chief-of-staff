"use client"

import { Menu } from "@base-ui/react/menu"
import { TriageCategory } from "@/lib/types"

type Props = {
  current: TriageCategory
  isOverridden: boolean
  onChange: (triage: TriageCategory) => void
}

const options: { key: TriageCategory; label: string; bg: string; text: string }[] = [
  { key: "Decide", label: "Decide", bg: "bg-decide/15 border-decide/25", text: "text-decide" },
  { key: "Delegate", label: "Delegate", bg: "bg-delegate/15 border-delegate/25", text: "text-delegate" },
  { key: "Ignore", label: "Ignore", bg: "bg-muted border-border/60", text: "text-muted-foreground" },
]

export function TriageDropdown({ current, isOverridden, onChange }: Props) {
  const currentMeta = options.find((o) => o.key === current) ?? options[2]

  return (
    <Menu.Root>
      <Menu.Trigger
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-md border cursor-pointer hover:opacity-80 transition-opacity duration-100 ${currentMeta.bg} ${currentMeta.text}`}
        onClick={(e) => e.stopPropagation()}
      >
        {currentMeta.label}
        {isOverridden && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6}>
          <Menu.Popup className="bg-background border border-border/60 rounded-lg shadow-lg py-1 z-50 min-w-[120px] animate-in fade-in zoom-in-[0.97] duration-100">
            {options.map((opt) => (
              <Menu.Item
                key={opt.key}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(opt.key)
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] font-medium transition-colors duration-75 hover:bg-muted/50 cursor-pointer flex items-center justify-between ${opt.text}`}
              >
                {opt.label}
                {opt.key === current && (
                  <span className="text-[10px] opacity-50">&#10003;</span>
                )}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
