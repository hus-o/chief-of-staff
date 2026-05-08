import { NormalizedMessage, FastPathResult, FastPathCategory } from "./types"

type DetectorResult = {
  category: FastPathCategory
  score: number
  reason: string
}

const FAST_PATH_THRESHOLD = 0.7

function senderName(from: string): string {
  return from.split("<")[0].trim() || from
}

function detectSecuritySuspicious(msg: NormalizedMessage): DetectorResult {
  let score = 0
  const signals: string[] = []
  const body = msg.body.toLowerCase()
  const from = msg.from.toLowerCase()

  // Suspicious sender patterns
  if (
    from.includes("noreply") &&
    (body.includes("verify") || body.includes("suspended"))
  ) {
    score += 0.4
    signals.push("noreply sender with verification request")
  }

  // Coercive urgency
  const urgencyPhrases = [
    "verify immediately",
    "account will be",
    "permanently suspended",
    "unusual sign-in",
    "unusual login",
    "verify now",
    "secure your account",
  ]
  for (const phrase of urgencyPhrases) {
    if (body.includes(phrase)) {
      score += 0.3
      signals.push(`coercive phrase: "${phrase}"`)
      break
    }
  }

  // Suspicious links in security context
  const urlPattern = /https?:\/\/[^\s]+/g
  const urls = body.match(urlPattern) || []
  for (const url of urls) {
    if (
      (body.includes("verify") || body.includes("secure")) &&
      !url.includes("google.com") &&
      !url.includes("microsoft.com")
    ) {
      score += 0.3
      signals.push("suspicious URL in security context")
      break
    }
  }

  // Credential language
  if (
    body.includes("password") ||
    body.includes("credential") ||
    body.includes("token")
  ) {
    score += 0.2
    signals.push("credential-related language")
  }

  return { category: "security_suspicious", score: Math.min(score, 1), reason: signals.join("; ") }
}

function detectBulkNoise(msg: NormalizedMessage): DetectorResult {
  let score = 0
  const signals: string[] = []
  const body = msg.body.toLowerCase()
  const from = msg.from.toLowerCase()

  if (from.includes("newsletter") || from.includes("noreply") || from.includes("digest")) {
    score += 0.3
    signals.push("newsletter/noreply sender")
  }

  if (body.includes("unsubscribe")) {
    score += 0.4
    signals.push("unsubscribe footer")
  }

  if ((body.includes("this week") && body.includes("roundup")) || body.includes("weekly")) {
    score += 0.2
    signals.push("weekly roundup language")
  }

  // Numbered list pattern common in newsletters
  const numberedList = body.match(/\d+\.\s/g)
  if (numberedList && numberedList.length >= 3) {
    score += 0.1
    signals.push("numbered list format")
  }

  return { category: "bulk_noise", score: Math.min(score, 1), reason: signals.join("; ") }
}

function detectPersonalNonwork(msg: NormalizedMessage): DetectorResult {
  let score = 0
  const signals: string[] = []
  const body = msg.body.toLowerCase()
  const from = msg.from.toLowerCase()

  const familyTerms = ["mum", "mom", "dad", "sister", "brother", "hi love", "xx"]
  for (const term of familyTerms) {
    if (body.includes(term) || from.includes(term)) {
      score += 0.3
      signals.push(`family indicator: "${term}"`)
    }
  }

  const personalTerms = ["dinner", "lasagne", "lasagna", "wine", "shopping"]
  for (const term of personalTerms) {
    if (body.includes(term)) {
      score += 0.2
      signals.push(`personal topic: "${term}"`)
    }
  }

  // No work relevance
  const workTerms = [
    "project", "deal", "client", "revenue", "meeting", "deadline",
    "budget", "team", "hire", "contract", "pipeline", "investor",
  ]
  const hasWorkContent = workTerms.some((t) => body.includes(t))
  if (!hasWorkContent && score > 0) {
    score += 0.2
    signals.push("no work-related content")
  }

  return { category: "personal_nonwork", score: Math.min(score, 1), reason: signals.join("; ") }
}

function detectObviousFyi(msg: NormalizedMessage): DetectorResult {
  let score = 0
  const signals: string[] = []
  const body = msg.body.toLowerCase()

  const fyiPhrases = [
    "no action needed",
    "no decisions needed",
    "just keeping you in the loop",
    "just wanted to let you know",
    "no action required",
  ]

  for (const phrase of fyiPhrases) {
    if (body.includes(phrase)) {
      score += 0.5
      signals.push(`explicit FYI: "${phrase}"`)
      break
    }
  }

  // Penalize if it contains questions or requests
  if (body.includes("?") && !body.includes("let me know if you need anything")) {
    score -= 0.3
    signals.push("contains questions")
  }
  if (body.includes("please") && (body.includes("send") || body.includes("confirm") || body.includes("review"))) {
    score -= 0.4
    signals.push("contains a request")
  }

  return { category: "obvious_fyi", score: Math.max(score, 0), reason: signals.join("; ") }
}

function buildUserFacingText(
  category: FastPathCategory,
  msg: NormalizedMessage
): { title: string; displayReason: string } {
  switch (category) {
    case "security_suspicious":
      return {
        title: `Suspicious Email from ${senderName(msg.from)}`,
        displayReason: `This message contains signs of a phishing attempt. Do not click any links or provide credentials.`,
      }
    case "bulk_noise":
      return {
        title: msg.subject || `Newsletter from ${senderName(msg.from)}`,
        displayReason: `Automated newsletter or marketing email. No action required.`,
      }
    case "personal_nonwork":
      return {
        title: `Personal message from ${msg.from}`,
        displayReason: `This is a personal, non-work message. Filtered from your business triage.`,
      }
    case "obvious_fyi":
      return {
        title: msg.subject || `FYI from ${senderName(msg.from)}`,
        displayReason: `Informational update with no action or decision required from you.`,
      }
  }
}

export function runFastPathDetectors(messages: NormalizedMessage[]): {
  fastPathResults: FastPathResult[]
  businessQueue: NormalizedMessage[]
} {
  const fastPathResults: FastPathResult[] = []
  const businessQueue: NormalizedMessage[] = []

  for (const msg of messages) {
    const detections = [
      detectSecuritySuspicious(msg),
      detectBulkNoise(msg),
      detectPersonalNonwork(msg),
      detectObviousFyi(msg),
    ]

    const best = detections.reduce((a, b) => (a.score > b.score ? a : b))

    if (best.score >= FAST_PATH_THRESHOLD) {
      const { title, displayReason } = buildUserFacingText(best.category, msg)
      fastPathResults.push({
        messageId: msg.id,
        category: best.category,
        title,
        triage: "Ignore",
        reason: best.reason,
        displayReason,
        flag:
          best.category === "security_suspicious"
            ? { type: "phishing", severity: "high", reason: "Suspected phishing attempt — do not click links" }
            : null,
        draftResponse:
          best.category === "security_suspicious"
            ? "This appears to be a phishing attempt. Do not click any links. Forward to IT security."
            : null,
      })
    } else {
      businessQueue.push(msg)
    }
  }

  return { fastPathResults, businessQueue }
}
