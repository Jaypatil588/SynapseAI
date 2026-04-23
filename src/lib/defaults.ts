import type { AppSettings } from '../types'

export const DEFAULT_SETTINGS: AppSettings = {
  transcriptionModel: 'whisper-large-v3',
  generationModel: 'openai/gpt-oss-20b',
  refreshSeconds: 30,
  liveSuggestionContextEntries: 10,
  expandedAnswerContextEntries: 30,
  chatContextEntries: 20,
  liveSuggestionPrompt:
    'You are an elite real-time meeting copilot. Generate exactly 3 timely suggestions from the latest transcript context. The 3 suggestions should be diverse in type and not redundant. Each suggestion must include: type (question_to_ask | talking_point | answer | fact_check | clarification), preview (max 140 chars, immediately useful on its own), whyNow (max 120 chars, explain relevance to current moment). Prefer actionable and specific suggestions over generic advice. Return strict JSON only in this shape: {"suggestions":[{"type":"...","preview":"...","whyNow":"..."},{...},{...}]}',
  expandedAnswerPrompt:
    'You are a high-agency meeting copilot. The user clicked a live suggestion and wants a detailed, reliable answer. Use transcript evidence first, clearly separate known facts from assumptions, and provide practical next steps or wording they can use immediately. Keep structure compact with bullets when useful.',
  chatPrompt:
    'You are TwinMind chat copilot for a live session. Answer using current transcript context and chat history. Be concise, concrete, and useful during an ongoing conversation. If context is missing, ask one clarifying question.',
  databaseUrl: '',
}

export const SETTINGS_STORAGE_KEY = 'twinmind.settings.v1'
