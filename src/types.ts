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
}

export type SuggestionBatch = {
  id: string
  timestamp: string
  items: SuggestionItem[]
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
  liveSuggestionPrompt: string
  expandedAnswerPrompt: string
  chatPrompt: string
  databaseUrl: string
}

export type ExportPayload = {
  exportedAt: string
  transcript: TranscriptEntry[]
  suggestionBatches: SuggestionBatch[]
  chatHistory: ChatMessage[]
}
