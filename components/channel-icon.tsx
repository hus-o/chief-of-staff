"use client"

import { Envelope, SlackLogo, WhatsappLogo, ChatCircle } from "@phosphor-icons/react"

export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const props = { weight: "regular" as const, className: className ?? "w-3.5 h-3.5" }
  switch (channel) {
    case "email": return <Envelope {...props} />
    case "slack": return <SlackLogo {...props} />
    case "whatsapp": return <WhatsappLogo {...props} />
    default: return <ChatCircle {...props} />
  }
}
