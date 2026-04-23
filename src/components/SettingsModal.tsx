import type { ChangeEvent } from 'react'
import type { AppSettings } from '../types'

type SettingsModalProps = {
  isOpen: boolean
  apiKey: string
  settings: AppSettings
  onApiKeyChange: (value: string) => void
  onSettingsChange: (next: AppSettings) => void
  onClose: () => void
}

export function SettingsModal({
  isOpen,
  apiKey,
  settings,
  onApiKeyChange,
  onSettingsChange,
  onClose,
}: SettingsModalProps) {
  if (!isOpen) return null

  function onTextSettingChange(
    key: keyof AppSettings,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onSettingsChange({
      ...settings,
      [key]: event.target.value,
    })
  }

  function onNumberSettingChange(key: keyof AppSettings, event: ChangeEvent<HTMLInputElement>) {
    const parsed = Number(event.target.value)
    onSettingsChange({
      ...settings,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    })
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal-card">
        <header>
          <h2>Settings</h2>
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
            />
          </label>

          <label>
            Neon Database URL
            <input
              type="password"
              placeholder="postgres://..."
              value={settings.databaseUrl || ''}
              onChange={(event) => onTextSettingChange('databaseUrl', event)}
            />
          </label>

          <div className="settings-grid">
            <label>
              Transcription Model
              <input
                type="text"
                value={settings.transcriptionModel}
                onChange={(event) => onTextSettingChange('transcriptionModel', event)}
              />
            </label>

            <label>
              Generation Model
              <input
                type="text"
                value={settings.generationModel}
                onChange={(event) => onTextSettingChange('generationModel', event)}
              />
            </label>

            <label>
              Refresh Seconds
              <input
                type="number"
                min={10}
                value={settings.refreshSeconds}
                onChange={(event) => onNumberSettingChange('refreshSeconds', event)}
              />
            </label>

            <label>
              Live Suggestion Context (entries)
              <input
                type="number"
                min={1}
                value={settings.liveSuggestionContextEntries}
                onChange={(event) => onNumberSettingChange('liveSuggestionContextEntries', event)}
              />
            </label>

            <label>
              Expanded Answer Context (entries)
              <input
                type="number"
                min={1}
                value={settings.expandedAnswerContextEntries}
                onChange={(event) => onNumberSettingChange('expandedAnswerContextEntries', event)}
              />
            </label>

            <label>
              Chat Context (entries)
              <input
                type="number"
                min={1}
                value={settings.chatContextEntries}
                onChange={(event) => onNumberSettingChange('chatContextEntries', event)}
              />
            </label>
          </div>

          <label>
            Transcription Hint (Whisper prompt — vocabulary & style, not instructions)
            <textarea
              rows={3}
              value={settings.transcriptionPrompt}
              onChange={(event) => onTextSettingChange('transcriptionPrompt', event)}
            />
          </label>

          <label>
            Live Suggestion Prompt
            <textarea
              rows={8}
              value={settings.liveSuggestionPrompt}
              onChange={(event) => onTextSettingChange('liveSuggestionPrompt', event)}
            />
          </label>

          <label>
            Chat System Prompt
            <textarea
              rows={6}
              value={settings.chatPrompt}
              onChange={(event) => onTextSettingChange('chatPrompt', event)}
            />
          </label>

          <label>
            Gap Summarizer Prompt (background transcript compression)
            <textarea
              rows={6}
              value={settings.gapSummaryPrompt}
              onChange={(event) => onTextSettingChange('gapSummaryPrompt', event)}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
