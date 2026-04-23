import type { ChangeEvent } from 'react'
import type { AppSettings } from '../types'

type SettingsModalProps = {
  isOpen: boolean
  apiKey: string
  onApiKeyChange: (value: string) => void
  onClose: () => void
}

export function SettingsModal({
  isOpen,
  apiKey,
  onApiKeyChange,
  onClose,
}: SettingsModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Groq key settings">
      <div className="modal-card">
        <header>
          <h2>Groq key settings</h2>
          <button onClick={onClose}>Close</button>
        </header>

        <div className="modal-body">
          <label>
            Groq API Key
            <input
              type="password"
              placeholder="gsk_..."
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && apiKey.trim()) {
                  onClose()
                }
              }}
            />
          </label>
          <button 
            className="primary" 
            onClick={onClose}
            disabled={!apiKey.trim()}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
