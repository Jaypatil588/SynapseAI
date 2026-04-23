export type TranscriptEntry = {
  id: string
  text: string
  timestamp: string
}

export type SuggestionType =
  | 'question_to_ask'
  | 'talking_point'
  | 'answer'
  | 'fact_check'
  | 'clarification'

export type SuggestionItem = {
  id: string
  preview: string
  type: SuggestionType
  whyNow: string
  rank: number // 1 = highest relevance, 5 = lowest
}

export type TypeRanking = Record<SuggestionType, number>

export type SuggestionBatch = {
  id: string
  batchNumber: number
  timestamp: string
  items: SuggestionItem[]      // all 5, sorted by rank asc
  typeRanking: TypeRanking     // raw ranking from model: type → rank (1=best)
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  timestamp: string
  source: 'suggestion' | 'chat'
}

export type AppSettings = {
  transcriptionModel: string
  generationModel: string
  refreshSeconds: number
  liveSuggestionContextEntries: number
  expandedAnswerContextEntries: number
  chatContextEntries: number
  transcriptionPrompt: string
  liveSuggestionPrompt: string
  chatPrompt: string
  gapSummaryPrompt: string
  databaseUrl: string
}

export type ExportPayload = {
  exportedAt: string
  transcript: TranscriptEntry[]
  suggestionBatches: SuggestionBatch[]
  chatHistory: ChatMessage[]
}
