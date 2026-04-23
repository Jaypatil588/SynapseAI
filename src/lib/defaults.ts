import type { AppSettings } from '../types'

export const DEFAULT_SETTINGS: AppSettings = {
  transcriptionModel: 'whisper-large-v3',
  generationModel: 'openai/gpt-oss-120b',
  refreshSeconds: 30,
  liveSuggestionContextEntries: 10,
  expandedAnswerContextEntries: 30,
  chatContextEntries: 20,
  databaseUrl: '',
}

export const SETTINGS_STORAGE_KEY = 'twinmind.settings.v4'

