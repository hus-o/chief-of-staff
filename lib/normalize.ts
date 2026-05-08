import { RawMessage, NormalizedMessage } from "./types"

export function normalizeMessages(raw: RawMessage[]): NormalizedMessage[] {
  return raw.map((msg) => ({
    id: String(msg.id),
    channel: msg.channel,
    from: msg.from,
    to: msg.to ?? null,
    subject: msg.subject ?? null,
    channelName: msg.channel_name ?? null,
    timestamp: msg.timestamp,
    body: msg.body,
  }))
}
