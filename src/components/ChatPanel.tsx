import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { formatTime } from '../lib/utils'
import type { ChatMessage } from '../types'

type ChatPanelProps = {
  messages: ChatMessage[]
  isLoading: boolean
  suggestionCadenceSeconds: number
  onSubmitQuestion: (question: string) => Promise<void>
}

export function ChatPanel({
  messages,
  isLoading,
  suggestionCadenceSeconds,
  onSubmitQuestion,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [messages, isLoading])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setInput('')
    await onSubmitQuestion(trimmed)
  }

  return (
    <section className="panel chat-panel">
      <div className="panel__header">
        <h2>Chat</h2>
        <div className="chat-header-controls">
          <span className={isLoading ? 'pill pill--working' : 'pill'}>
            {isLoading ? 'Generating...' : `Suggest every ${suggestionCadenceSeconds}s`}
          </span>
        </div>
      </div>

      <div className="panel__content" ref={containerRef}>
        {messages.length === 0 ? (
          <p className="empty-state">
            Click a suggestion or ask a direct question to start the session chat.
          </p>
        ) : (
          messages.map((message) => (
            <article className={`chat-message chat-message--${message.role}`} key={message.id}>
              <header>
                <strong>{message.role === 'user' ? 'You' : 'TwinMind'}</strong>
                <time>{formatTime(message.timestamp)}</time>
              </header>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <textarea
          placeholder="Ask a question about this session..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
