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
        <h1>SynapseAI Live </h1>
        <p>Transcript, suggestions, and chat in one real-time session.</p>
      </div>

      <div className="control-bar__actions">
        <button className={isRecording ? 'danger' : 'primary'} onClick={onToggleRecording}>
          {isRecording ? 'Stop Recording' : 'Start Mic'}
        </button>
        <button
          onClick={onToggleLargeModel}
          title={isLargeModel ? 'Using gpt-oss-120b (click to switch to 20b)' : 'Using gpt-oss-20b (click to switch to 120b)'}
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {isLargeModel ? '120b ⚡' : '20b'}
        </button>
        <button
          onClick={onToggleLanguage}
          title={transcribeLanguage === 'en' ? 'Enforcing English transcription (click for auto-detect)' : 'Auto-detecting language (click to enforce English)'}
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {transcribeLanguage === 'en' ? 'EN' : 'AUTO'}
        </button>
        <button onClick={onManualRefresh} disabled={isBusy}>
          Refresh Now
        </button>
        <button onClick={onExport}>Export Session</button>
        <button onClick={onOpenSettings}>Groq Key Settings</button>
      </div>
    </header>
  )
}
