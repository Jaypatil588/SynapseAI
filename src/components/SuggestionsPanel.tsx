import { formatTime } from '../lib/utils'
import type { SuggestionBatch, SuggestionItem } from '../types'

import { useEffect, useState } from 'react'

type SuggestionsPanelProps = {
  batches: SuggestionBatch[]
  isLoading: boolean
  isRecording: boolean
  lastRefreshAt: string | null
  refreshCadenceSeconds: number
  onSelectSuggestion: (suggestion: SuggestionItem, batch: SuggestionBatch) => void
}

function prettyType(type: SuggestionItem['type']) {
  switch (type) {
    case 'question_to_ask':
      return 'Question'
    case 'talking_point':
      return 'Talking Point'
    case 'answer':
      return 'Answer'
    case 'fact_check':
      return 'Fact Check'
    case 'clarification':
      return 'Clarification'
    default:
      return 'Suggestion'
  }
}

export function SuggestionsPanel({
  batches,
  isLoading,
  isRecording,
  lastRefreshAt,
  refreshCadenceSeconds,
  onSelectSuggestion,
}: SuggestionsPanelProps) {
  const [timeLeft, setTimeLeft] = useState(refreshCadenceSeconds)

  useEffect(() => {
    if (!isRecording) {
       setTimeLeft(refreshCadenceSeconds);
       return;
    }
    const interval = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefreshAt, isRecording, refreshCadenceSeconds]);

  return (
    <section className="panel suggestions-panel">
      <div className="panel__header">
        <h2>Live Suggestions</h2>
        <span className={isLoading ? 'pill pill--working' : 'pill'}>
          {isLoading ? 'Refreshing...' : isRecording ? `Next in ${timeLeft}s` : 'Idle'}
        </span>
      </div>

      <div className="panel__content">
        {batches.length === 0 ? (
          <p className="empty-state">Suggestion batches will stack here as transcript context grows.</p>
        ) : (
          batches.map((batch) => (
            <article className="suggestion-batch" key={batch.id}>
              <header>
                <h3>Batch {batch.id.slice(-4)}</h3>
                <time>{formatTime(batch.timestamp)}</time>
              </header>

              <div className="suggestion-grid">
                {batch.items.map((item) => (
                  <button
                    key={item.id}
                    className="suggestion-card"
                    onClick={() => onSelectSuggestion(item, batch)}
                  >
                    <span className={`suggestion-type suggestion-type--${item.type}`}>
                      {prettyType(item.type)}
                    </span>
                    <p>{item.preview}</p>
                    <small>{item.whyNow}</small>
                  </button>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
