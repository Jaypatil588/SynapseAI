import type { SuggestionItem, SuggestionType, TranscriptEntry } from '../types'

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function transcriptToContext(entries: TranscriptEntry[], limit: number): string {
  if (!entries.length) {
    return 'No transcript yet.'
  }

  return entries
    .slice(-limit)
    .map((entry) => `[${formatTime(entry.timestamp)}] ${entry.text}`)
    .join('\n')
export type BoundedContext = {
  head: string
  tail: string
  omittedEntries: TranscriptEntry[]
}

/**
 * Bookend strategy: takes entries from both the start AND end of the transcript
 * up to a character budget (~4 chars per token), isolating the omitted middle entries.
 */
export function transcriptToContextBounded(
  entries: TranscriptEntry[],
  maxTokens = 2000
): BoundedContext {
  if (!entries.length) return { head: 'No transcript yet.', tail: '', omittedEntries: [] }

  const charBudget = maxTokens * 4 // rough estimate: 1 token ≈ 4 chars
  const lines = entries.map((e) => `[${formatTime(e.timestamp)}] ${e.text}`)

  // Check if everything fits
  const full = lines.join('\n')
  if (full.length <= charBudget) return { head: full, tail: '', omittedEntries: [] }

  // Bookend: fill from each end toward the middle
  const halfBudget = Math.floor(charBudget / 2)
  const headLines: string[] = []
  const tailLines: string[] = []
  let headChars = 0
  let tailChars = 0
  let lo = 0
  let hi = lines.length - 1

  while (lo <= hi) {
    if (headChars <= tailChars && lo <= hi) {
      const line = lines[lo]
      if (headChars + line.length + 1 > halfBudget) break
      headLines.push(line)
      headChars += line.length + 1
      lo++
    } else {
      const line = lines[hi]
      if (tailChars + line.length + 1 > halfBudget) break
      tailLines.unshift(line)
      tailChars += line.length + 1
      hi--
    }
  }

  const omittedEntries = entries.slice(lo, hi + 1)

  return { head: headLines.join('\n'), tail: tailLines.join('\n'), omittedEntries }
}

export function parseSuggestionResponse(raw: string): SuggestionItem[] {
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '')
  const parsed = JSON.parse(cleaned) as {
    suggestions?: Array<{ type?: string; preview?: string; whyNow?: string }>
  }

  const allowedTypes: SuggestionType[] = [
    'question_to_ask',
    'talking_point',
    'answer',
    'fact_check',
    'clarification',
  ]

  const suggestions = (parsed.suggestions ?? [])
    .slice(0, 3)
    .map((item) => {
      const type = allowedTypes.includes(item.type as SuggestionType)
        ? (item.type as SuggestionType)
        : 'clarification'

      return {
        id: uid('suggestion'),
        type,
        preview: (item.preview ?? '').trim(),
        whyNow: (item.whyNow ?? '').trim(),
      }
    })
    .filter((item) => item.preview.length > 0)

  return suggestions
}

export function fallbackSuggestions(transcript: TranscriptEntry[]): SuggestionItem[] {
  const latest = transcript.at(-1)?.text || 'No transcript yet.'

  return [
    {
      id: uid('suggestion'),
      type: 'clarification',
      preview: `Clarify the main objective from this point: "${latest.slice(0, 80)}"`,
      whyNow: 'Helps align everyone on what success looks like right now.',
    },
    {
      id: uid('suggestion'),
      type: 'question_to_ask',
      preview: 'Ask what decision is needed in the next 10 minutes and who owns it.',
      whyNow: 'Pushes the conversation toward commitment and ownership.',
    },
    {
      id: uid('suggestion'),
      type: 'talking_point',
      preview: 'Summarize what is confirmed vs unknown before moving to next topic.',
      whyNow: 'Prevents confusion and reduces rework later.',
    },
  ]
}
