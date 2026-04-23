import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/utils'
import type { TranscriptEntry } from '../types'

type TranscriptPanelProps = {
  entries: TranscriptEntry[]
  isRecording: boolean
  isTranscribing: boolean
  userContext: string
  slidingWindowContext: string
  onUserContextChange: (val: string) => void
}

export function TranscriptPanel({ 
  entries, 
  isRecording, 
  isTranscribing,
  userContext,
  slidingWindowContext,
  onUserContextChange
}: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !autoScroll) return
    containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
  }, [entries, autoScroll])

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop <= clientHeight + 20;
    setAutoScroll(isAtBottom);
  }

  return (
    <section className="panel transcript-panel">
      <div className="panel__header">
        <h2>Live Transcript</h2>
        <div className="status-row">
          <span className={isRecording ? 'pill pill--recording' : 'pill'}>
            {isRecording ? 'Recording' : 'Idle'}
          </span>
          <span className={isTranscribing ? 'pill pill--working' : 'pill'}>
            {isTranscribing ? 'Transcribing...' : 'Ready'}
          </span>
        </div>
      </div>

      <div className="panel__content" ref={containerRef} onScroll={handleScroll}>
        <div className="context-window">
          <textarea 
            placeholder="Add manual context or overrides (acts as constant system prompt)..."
            value={userContext}
            onChange={(e) => onUserContextChange(e.target.value)}
            rows={2}
          />
          <details className="context-details">
            <summary>View Sliding Window Context (Last 5 Mins)</summary>
            <div className="context-details__content">
              {slidingWindowContext}
            </div>
          </details>
        </div>

        {entries.length === 0 ? (
          <p className="empty-state">Transcript chunks will appear here every ~30 seconds.</p>
        ) : (
          entries.map((entry) => (
            <article className="transcript-line" key={entry.id}>
              <time>{formatTime(entry.timestamp)}</time>
              <p>{entry.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
