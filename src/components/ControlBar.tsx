import { formatTime } from '../lib/utils'

type ControlBarProps = {
  isRecording: boolean
  isBusy: boolean
  transcriptCount: number
  suggestionBatchCount: number
  lastSuggestionLatencyMs: number | null
  lastChatLatencyMs: number | null
  lastRefreshAt: string | null
  isFastTranscribeMode: boolean
  isLargeModel: boolean
  onToggleFastTranscribeMode: () => void
  onToggleLargeModel: () => void
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
  isFastTranscribeMode,
  isLargeModel,
  onToggleFastTranscribeMode,
  onToggleLargeModel,
  onToggleRecording,
  onManualRefresh,
  onExport,
  onOpenSettings,
}: ControlBarProps) {
  return (
    <header className="control-bar">
      <div className="control-bar__left">
        <h1>TwinMind Live Suggestions</h1>
        <p>Transcript, suggestions, and chat in one real-time session.</p>
      </div>

      <div className="control-bar__actions">
        <button className={isRecording ? 'danger' : 'primary'} onClick={onToggleRecording}>
          {isRecording ? 'Stop Recording' : 'Start Mic'}
        </button>
        <label className="toggle-row" style={{ marginRight: '8px', marginLeft: '4px' }}>
          <input
            type="checkbox"
            checked={isFastTranscribeMode}
            onChange={onToggleFastTranscribeMode}
          />
          <span>Fast Mode</span>
        </label>
        <button
          onClick={onToggleLargeModel}
          title={isLargeModel ? 'Using gpt-oss-120b (click to switch to 20b)' : 'Using gpt-oss-20b (click to switch to 120b)'}
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {isLargeModel ? '120b ⚡' : '20b'}
        </button>
        <button onClick={onManualRefresh} disabled={isBusy}>
          Refresh Now
        </button>
        <button onClick={onExport}>Export Session</button>
        <button onClick={onOpenSettings}>Settings</button>
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
