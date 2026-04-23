import { formatTime } from '../lib/utils'

type ControlBarProps = {
  isRecording: boolean
  isBusy: boolean
  transcriptCount: number
  suggestionBatchCount: number
  lastSuggestionLatencyMs: number | null
  lastChatLatencyMs: number | null
  lastRefreshAt: string | null
  isLargeModel: boolean
  transcribeLanguage: 'en' | 'auto'
  onToggleLargeModel: () => void
  onToggleLanguage: () => void
  onToggleRecording: () => void
  onManualRefresh: () => void
  onExport: () => void
  onOpenSettings: () => void
}

export function ControlBar({
  isRecording,
  isBusy,
  transcriptCount,
  suggestionBatchCount,
  lastSuggestionLatencyMs,
  lastChatLatencyMs,
  lastRefreshAt,
  isLargeModel,
  transcribeLanguage,
  onToggleLargeModel,
  onToggleLanguage,
  onToggleRecording,
  onManualRefresh,
  onExport,
  onOpenSettings,
}: ControlBarProps) {
  return (
    <header className="control-bar">
      <div className="control-bar__left">
        <h1>SynapseAI Live Suggestions</h1>
        <p>Transcript, suggestions, and chat in one real-time session.</p>
      </div>

      <div className="control-bar__actions">
        <button className={isRecording ? 'danger' : 'primary'} onClick={onToggleRecording}>
          {isRecording ? 'Stop Recording' : 'Start Mic'}
        </button>
        <button
          className="control-bar__toggle-btn"
          onClick={onToggleLargeModel}
          title={isLargeModel ? 'Using gpt-oss-120b (click to switch to 20b)' : 'Using gpt-oss-20b (click to switch to 120b)'}
        >
          {isLargeModel ? '120b ⚡' : '20b'}
        </button>
        <button
          className="control-bar__toggle-btn"
          onClick={onToggleLanguage}
          title={transcribeLanguage === 'en' ? 'Enforcing English transcription (click for auto-detect)' : 'Auto-detecting language (click to enforce English)'}
        >
          {transcribeLanguage === 'en' ? 'EN' : 'AUTO'}
        </button>
        <button onClick={onManualRefresh} disabled={isBusy}>
          Refresh Now
        </button>
        <button onClick={onExport}>Export Session</button>
        <button onClick={onOpenSettings}>Groq Key Settings</button>
      </div>

      <div className="control-bar__meta">
        <span>Transcript: {transcriptCount}</span>
        <span>Batches: {suggestionBatchCount}</span>
        <span>
          Suggestion Latency:{' '}
          {lastSuggestionLatencyMs !== null ? `${lastSuggestionLatencyMs}ms` : '--'}
        </span>
        <span>Chat Latency: {lastChatLatencyMs !== null ? `${lastChatLatencyMs}ms` : '--'}</span>
        <span>Last Refresh: {lastRefreshAt ? formatTime(lastRefreshAt) : '--'}</span>
      </div>
    </header>
  )
}
