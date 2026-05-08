# AI Chief of Staff

## Deployment 
> [chief-of-staff-wheat.vercel.app](https://chief-of-staff-wheat.vercel.app/)

## Thoughts and Notes

- The idea is not a live mailbox but rather a daily digest so the demo shows a simulation of messages from different integrations being ingested into a queue (currently it's just a json file but in production you can imagine this as a connection to these different platforms), then on a schedule/manual trigger all these messages are analysed to triage and provide a daily brief.
- I used free deployment platforms (Vercel) and LLMs (Gemini) so some slowness is expected in the demo but in production these would be upgraded, for example the LLM can be from a faster inference provider like groq.
- Initially went for just an embedding clustering and LLM calls or just a single LLM pass, this would sometimes produce excellent results when doing a single LLM pass but this isn't scaleable as message size increases the context size of the LLM call is going to deteriorate. And a mix of embedding and LLM calls was ok but could take too long or produce inconsistent results. 
- Then after some research introduced Agglomerative Clustering with Complete Linkage, which basically means each message is treated as alone, then by comparison messages that are similar enough (above a threshold) are grouped, this happens until all messages that are similar enough are grouped together where by as the size of a group increases all the messages in that group have to be similar to anything it is being compared against not just one or some. This improved our time taken and quality of clusters.
- As it's a demo we expect mostly a happy path and proper data, of course in a prod environment there would be stricter checking of malformed data, errors and normalisation

## How It Works

Messages go through 5 stages:

- **Filter out noise** — spam, phishing, and personal messages are caught automatically without using AI
- **Understand each message** — AI reads every message and pulls out who's involved, how urgent it is, and a quick summary
- **Group related messages** — messages about the same topic or thread are clustered together into a single work item
- **Triage each item** — AI decides whether the CEO needs to act, delegate, or ignore - and drafts a response where appropriate
- **Write a daily briefing** — a final pass produces an executive summary of everything that matters today

## Running Locally

```bash
git clone <repo-url>
cd ai-chief-of-staff
npm install
touch .env.local # Add your Gemini API key
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key (get one at https://aistudio.google.com/apikey) |

## Architecture Decisions

- **Staged pipeline instead of one big prompt** - breaks the problem into smaller, reliable steps that can each be tested and improved independently
- **Similarity-based grouping** — messages are grouped by meaning, not just keywords, so related threads are handled together
- **AI double-checks its own groupings** — when synthesising a cluster, the AI can reject a false grouping at no extra cost
- **Conservative spam filtering** — we'd rather over-analyse a message than accidentally ignore something important
- **Gemini Flash** — fast, affordable, and good at structured output

## Scale Assumptions

- Built for daily batches of up to around 200 messages (processes in under 60 seconds)
- For larger volumes (1000+), we'd add parallel processing, chunked API calls, progressive UI loading, and a background job queue

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui
- Vercel AI SDK + Google Gemini (gemini-3-flash-preview + gemini-embedding-2)
- Zod for schema validation
