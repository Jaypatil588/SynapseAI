import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { ControlBar } from './components/ControlBar'
import { ApiTestLab } from './components/ApiTestLab'
import { SettingsModal } from './components/SettingsModal'
import { SuggestionsPanel } from './components/SuggestionsPanel'
import { TranscriptPanel } from './components/TranscriptPanel'
import { Dashboard } from './components/Dashboard'
import { TopNav } from './components/TopNav'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './lib/defaults'
import { groqChatCompletion, groqStreamChatCompletion, groqTranscribeAudio } from './lib/groq'
import {
  fallbackSuggestions,
  nowIso,
  parseSuggestionResponse,
  transcriptToContext,
  transcriptToContextBounded,
  uid,
} from './lib/utils'
import { initializeDatabase, saveSessionState } from './lib/db'
import type {
  AppSettings,
  ChatMessage,
  ExportPayload,
  SuggestionBatch,
  SuggestionItem,
  TranscriptEntry,
} from './types'
import './index.css'


function App() {
  const envApiKey = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim() ?? ''
  const [apiKey, setApiKey] = useState(envApiKey)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return DEFAULT_SETTINGS

    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<AppSettings>) }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState(!envApiKey)
  const [isRecording, setIsRecording] = useState(false)
  const isLargeModel = settings.generationModel === 'openai/gpt-oss-120b'
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const [isGeneratingChat, setIsGeneratingChat] = useState(false)

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [gapSummary, setGapSummary] = useState<string>('')

  const [lastSuggestionLatencyMs, setLastSuggestionLatencyMs] = useState<number | null>(null)
  const [lastChatLatencyMs, setLastChatLatencyMs] = useState<number | null>(null)
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userContext, setUserContext] = useState('')
  
  // View state: 'dashboard' or 'session'
  const [activeView, setActiveView] = useState<'dashboard' | 'session'>('session')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const volumeIntervalRef = useRef<number | undefined>(undefined)
  const chunkIntervalRef = useRef<number | undefined>(undefined)
  const hasSpokenInChunkRef = useRef(false)
  const sliceIsValidRef = useRef(false)
  
  const pendingManualRefreshRef = useRef(false)

  const apiKeyRef = useRef(apiKey)
  const settingsRef = useRef(settings)
  const transcriptRef = useRef<TranscriptEntry[]>(transcript)
  const userContextRef = useRef('')
  const isGeneratingSuggestionsRef = useRef(false)
  const suggestionBatchesRef = useRef<SuggestionBatch[]>([])
  const chatHistoryRef = useRef<ChatMessage[]>([])
  const gapSummaryRef = useRef<string>('')
  const latestSummarizedGapChunkIdRef = useRef<string | null>(null)
  const isGeneratingGapSummaryRef = useRef(false)

  const lastSuggestionGenAtRef = useRef(0);
  const batchCounterRef = useRef(0);

  const transcriptionQueueRef = useRef<Blob[]>([])
  const isProcessingTranscriptionQueueRef = useRef(false)



  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    apiKeyRef.current = apiKey
  }, [apiKey])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    userContextRef.current = userContext
  }, [userContext])

  useEffect(() => {
    suggestionBatchesRef.current = suggestionBatches
  }, [suggestionBatches])

  useEffect(() => {
    chatHistoryRef.current = chatHistory
  }, [chatHistory])

  useEffect(() => {
    gapSummaryRef.current = gapSummary
  }, [gapSummary])

  useEffect(() => {
    return () => {
      stopRecordingStream()
    }
  }, [])

  const suggestionCadenceSeconds = 30
  const isBusy = isTranscribing || isGeneratingSuggestions || isGeneratingChat

  // Reactive Event Pipeline
  useEffect(() => {
    if (!isRecording || !transcript.length) return;

    const now = Date.now();

    // 1. Suggestions Generation Pipeline (5-min sliding window)
    const timeSinceLastSuggestion = now - lastSuggestionGenAtRef.current;
    if (timeSinceLastSuggestion >= suggestionCadenceSeconds * 1000) {
      void refreshSuggestions();
      lastSuggestionGenAtRef.current = now;
    }

    // 2. Gap Summarizer Pipeline (Every 30s)
    const timeSinceLastSummary = now - (lastGapSummaryGenAtRef.current || 0);
    if (timeSinceLastSummary >= 30000) {
      void runGapSummarizer();
      lastGapSummaryGenAtRef.current = now;
    }
  }, [transcript, isRecording, suggestionCadenceSeconds]);

  const lastGapSummaryGenAtRef = useRef(0);

  async function runGapSummarizer() {
    if (isGeneratingGapSummaryRef.current || !transcriptRef.current.length) return;

    // Determine current gap
    const { omittedEntries } = transcriptToContextBounded(transcriptRef.current, 2000);
    if (!omittedEntries.length) return;

    // Filter to only new entries since last run
    const lastId = latestSummarizedGapChunkIdRef.current;
    let newEntriesForSummary = omittedEntries;
    if (lastId) {
      const idx = omittedEntries.findIndex(e => e.id === lastId);
      if (idx !== -1) {
        newEntriesForSummary = omittedEntries.slice(idx + 1);
      }
    }

    if (!newEntriesForSummary.length) return;

    isGeneratingGapSummaryRef.current = true;
    try {
      const trimmedKey = apiKeyRef.current.trim();
      if (!trimmedKey) return;

      const latestNewEntryId = newEntriesForSummary[newEntriesForSummary.length - 1].id;
      const newText = newEntriesForSummary.map(e => e.text).join('\n');

      const systemPrompt = settingsRef.current.gapSummaryPrompt;
      const userPrompt = gapSummaryRef.current
        ? `EXISTING RUNNING SUMMARY:\n<summary>\n${gapSummaryRef.current}\n</summary>\n\nNEW TRANSCRIPT LINES TO INTEGRATE:\n<new_lines>\n${newText}\n</new_lines>\n\nUpdate the summary by integrating these new lines chronologically. Do not duplicate existing content.`
        : `Summarize these transcript lines into a dense factual archive:\n<new_lines>\n${newText}\n</new_lines>`;

      const newSummary = await groqChatCompletion({
        apiKey: trimmedKey,
        model: settingsRef.current.generationModel,
        systemPrompt,
        userPrompt,
        temperature: 0.8
      });

      setGapSummary(newSummary);
      latestSummarizedGapChunkIdRef.current = latestNewEntryId;
    } catch (err) {
      console.error('Gap summarizer failed', err);
    } finally {
      isGeneratingGapSummaryRef.current = false;
    }
  }

  // DB Sync Interval
  useEffect(() => {
    if (!sessionId || isRecording === false) return;

    const intervalId = window.setInterval(() => {
      void saveSessionState(undefined, sessionId, {
        userContext: userContext,
        transcript: transcriptRef.current,
        recentSuggestions: suggestionBatchesRef.current.flatMap(b => b.items).slice(0, 15),
        chats: chatHistoryRef.current
      })
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [sessionId, isRecording, userContext]);

  async function toggleRecording() {
    if (!apiKeyRef.current.trim()) {
      setIsSettingsOpen(true)
      return
    }

    if (isRecording) {
      if (hasSpokenInChunkRef.current && mediaRecorderRef.current?.state === 'recording') {
        sliceIsValidRef.current = true;
      }
      stopRecordingStream()
      setIsRecording(false)
      return
    }

    try {
      void initializeDatabase()

      if (!sessionId) {
        setSessionId(uid('session'))
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop())
        console.warn('No microphone audio track captured.')
        setIsRecording(false)
        return
      }

      mediaStreamRef.current = stream

      // Initialize native Web Audio analyzer for volume filtering
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyzer = audioContext.createAnalyser()
      analyzer.fftSize = 256
      source.connect(analyzer)
      
      const dataArray = new Uint8Array(analyzer.frequencyBinCount)

      // Poll volume periodically. If it exceeds a static threshold (e.g. 15 on a 0-255 scale), flag the chunk.
      volumeIntervalRef.current = window.setInterval(() => {
        analyzer.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) { sum += dataArray[i] }
        const average = sum / dataArray.length
        
        if (average > 15) {
          hasSpokenInChunkRef.current = true
        }
      }, 100)

      const handleDataAvailable = (event: BlobEvent) => {
        if (!event.data || event.data.size < 4000) return // Increase to 4KB to avoid header-only/empty chunks
        if (sliceIsValidRef.current) {
          enqueueTranscriptionChunk(event.data)
          sliceIsValidRef.current = false
        }
      }

      const options = { mimeType: 'audio/webm' }
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = handleDataAvailable

      const sliceAndResetChunk = () => {
        // Did volume spike in the last 6s?
        if (hasSpokenInChunkRef.current && mediaRecorderRef.current?.state === 'recording') {
          sliceIsValidRef.current = true
        } else {
          sliceIsValidRef.current = false
        }

        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop()
        }

        if (mediaStreamRef.current) {
          const options = { mimeType: 'audio/webm' }
          const newRecorder = new MediaRecorder(mediaStreamRef.current, options)
          newRecorder.ondataavailable = handleDataAvailable
          newRecorder.start()
          mediaRecorderRef.current = newRecorder
        }

        hasSpokenInChunkRef.current = false
      }

      // Fixed 6-second hardware interval
      chunkIntervalRef.current = window.setInterval(sliceAndResetChunk, 6000)



      mediaRecorder.start()
      setIsRecording(true)
      setActiveView('session')
    } catch (error) {
      console.error('Microphone access failed:', error)
      stopRecordingStream()
      setIsRecording(false)
    }
  }

  function stopRecordingStream() {
    if (volumeIntervalRef.current !== undefined) {
      window.clearInterval(volumeIntervalRef.current)
      volumeIntervalRef.current = undefined
    }

    if (chunkIntervalRef.current !== undefined) {
      window.clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = undefined
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }
    audioContextRef.current = null

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaRecorderRef.current = null
    mediaStreamRef.current = null

    hasSpokenInChunkRef.current = false

    lastSuggestionGenAtRef.current = 0;
    lastGapSummaryGenAtRef.current = 0;
    batchCounterRef.current = 0;
    transcriptionQueueRef.current = []
    isProcessingTranscriptionQueueRef.current = false
  }

  function enqueueTranscriptionChunk(chunk: Blob) {
    if (!chunk || chunk.size < 1024) return

    transcriptionQueueRef.current.push(chunk)
    void processTranscriptionQueue()
  }

  async function processTranscriptionQueue() {
    if (isProcessingTranscriptionQueueRef.current) return

    const trimmedKey = apiKeyRef.current.trim()
    if (!trimmedKey) return

    isProcessingTranscriptionQueueRef.current = true
    setIsTranscribing(true)

    try {
      while (transcriptionQueueRef.current.length > 0) {
        const chunk = transcriptionQueueRef.current.shift()
        if (!chunk) continue

        try {
          const text = await groqTranscribeAudio({
            apiKey: trimmedKey,
            model: settingsRef.current.transcriptionModel,
            audio: chunk,
            prompt: settingsRef.current.transcriptionPrompt || undefined,
          })

          const normalizedText = normalizeChunkText(text, transcriptRef.current)
          if (!normalizedText) continue

          const entry: TranscriptEntry = {
            id: uid('transcript'),
            text: normalizedText,
            timestamp: nowIso(),
          }

          setTranscript((previous) => {
            const next = [...previous, entry]
            transcriptRef.current = next
            return next
          })
        } catch (error) {
          console.error('Transcription chunk failed:', error, chunk.type, chunk.size)
        }
      }
    } finally {
      isProcessingTranscriptionQueueRef.current = false
      setIsTranscribing(false)
    }
  }

  async function refreshSuggestions(transcriptInput?: TranscriptEntry[]) {
    if (isGeneratingSuggestionsRef.current) return

    const currentTranscript = transcriptInput ?? transcriptRef.current
    if (!currentTranscript.length) return

    const trimmedKey = apiKeyRef.current.trim()
    if (!trimmedKey) {
      return
    }

    isGeneratingSuggestionsRef.current = true
    setIsGeneratingSuggestions(true)
    const startedAt = performance.now()

    try {
      // Create a strict 5-minute sliding window filter for live suggestions
      const fiveMinsAgo = Date.now() - 300_000;
      const recentTranscript = currentTranscript.filter(t =>
        new Date(t.timestamp).getTime() > fiveMinsAgo
      );

      const transcriptContext = transcriptToContext(
        recentTranscript,
        recentTranscript.length
      )

      let userPrompt = [
        'Generate live suggestions from this transcript context.',
        'Return strict JSON with exactly 3 suggestions.',
        '',
        'Transcript context:',
        transcriptContext,
      ].join('\n')

      const recentSuggestionsText = suggestionBatchesRef.current
        .flatMap(batch => batch.items)
        .slice(0, 15)
        .map(i => i.preview)
        .join(' | ');

      let extendedSystemPrompt = settingsRef.current.liveSuggestionPrompt;
      if (userContextRef.current) {
        extendedSystemPrompt += `\n\nUSER DIRECTIVE (Prioritize this): ${userContextRef.current}`;
      }
      if (recentSuggestionsText) {
        extendedSystemPrompt += `\n\nNEGATIVE BIAS: Do NOT generate suggestions matching or repeating these recent ones: ${recentSuggestionsText}`;
      }

      const promptFull = userPrompt;

      const rawSuggestions = await groqChatCompletion({
        apiKey: trimmedKey,
        model: settingsRef.current.generationModel,
        systemPrompt: extendedSystemPrompt,
        userPrompt: promptFull,
        temperature: 0.8,
      });

      const { items: parsedItems, typeRanking } = parseSuggestionResponse(rawSuggestions)
      let mergedSuggestions = parsedItems
      if (mergedSuggestions.length < 3) {
        const fallback = fallbackSuggestions(currentTranscript)
        mergedSuggestions = [...mergedSuggestions, ...fallback].slice(0, 3)
      }

      const batch: SuggestionBatch = {
        id: uid('batch'),
        batchNumber: batchCounterRef.current++,
        timestamp: nowIso(),
        items: mergedSuggestions,
        typeRanking,
      }

      setSuggestionBatches((previous) => [batch, ...previous])
      setLastSuggestionLatencyMs(Math.round(performance.now() - startedAt))
      setLastRefreshAt(nowIso())
      pendingManualRefreshRef.current = false
    } catch (error) {
      console.error('Suggestion refresh failed:', error)
    } finally {
      isGeneratingSuggestionsRef.current = false
      setIsGeneratingSuggestions(false)
    }
  }

  async function handleManualRefresh() {

    const recorder = mediaRecorderRef.current
    if (isRecording && recorder && recorder.state === 'recording') {
      pendingManualRefreshRef.current = true
      recorder.requestData()

      setTimeout(() => {
        if (pendingManualRefreshRef.current) {
          void refreshSuggestions()
          pendingManualRefreshRef.current = false
        }
      }, 1200)
      return
    }

    await refreshSuggestions()
  }



  function toggleLargeModel() {
    setSettings((prev) => ({
      ...prev,
      generationModel: prev.generationModel === 'openai/gpt-oss-120b'
        ? 'openai/gpt-oss-20b'
        : 'openai/gpt-oss-120b'
    }))
  }

  async function answerFromSuggestion(suggestion: SuggestionItem) {
    const userMessage: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: suggestion.preview,
      timestamp: nowIso(),
      source: 'suggestion',
    }

    setChatHistory((previous) => [...previous, userMessage])

    const { head, tail, omittedEntries } = transcriptToContextBounded(
      transcriptRef.current,
      2000
    )

    const transcriptContext = omittedEntries.length > 0
      ? `${head}\n\n[... ${omittedEntries.length} entries omitted ...]\n[Summary of omitted section: ${gapSummaryRef.current || 'Pending...'}]\n\n${tail}`
      : head;
    const prompt = [
      'The user clicked this live suggestion:',
      `${suggestion.preview}`,
      '',
      `Suggestion type: ${suggestion.type}`,
      `Why now: ${suggestion.whyNow}`,
      '',
      'Transcript context:',
      transcriptContext,
    ].join('\n')

    await generateAssistantChat(prompt)
  }

  async function submitChatQuestion(question: string) {
    const userMessage: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: question,
      timestamp: nowIso(),
      source: 'chat',
    }

    setChatHistory((previous) => [...previous, userMessage])

    const { head, tail, omittedEntries } = transcriptToContextBounded(
      transcriptRef.current,
      2000
    )

    const transcriptContext = omittedEntries.length > 0
      ? `${head}\n\n[... ${omittedEntries.length} entries omitted ...]\n[Summary of omitted section: ${gapSummaryRef.current || 'Pending...'}]\n\n${tail}`
      : head;
    const recentMessages = chatHistory
      .slice(-8)
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n')

    const prompt = [
      'User question:',
      question,
      '',
      'Transcript context:',
      transcriptContext,
      '',
      'Recent chat:',
      recentMessages || 'No chat yet.',
    ].join('\n')

    await generateAssistantChat(prompt)
  }

  async function generateAssistantChat(prompt: string) {
    const trimmedKey = apiKeyRef.current.trim()
    if (!trimmedKey) {
      setIsSettingsOpen(true)
      return
    }

    setIsGeneratingChat(true)
    const startedAt = performance.now()

    try {
      // Initialize empty streaming message
      const msgId = uid('msg');
      setChatHistory((previous) => [
        ...previous,
        {
          id: msgId,
          role: 'assistant',
          content: '',
          timestamp: nowIso(),
          source: 'chat',
        }
      ]);

      // Stream directly — chatPrompt handles both suggestion drill-down and free-form chat
      const stream = await groqStreamChatCompletion({
        apiKey: trimmedKey,
        model: settingsRef.current.generationModel,
        systemPrompt: settingsRef.current.chatPrompt,
        userPrompt: prompt,
        temperature: 0.8,
        isHighComplexity: false
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || "";
        if (token) {
          setChatHistory((current) =>
            current.map((msg) =>
              msg.id === msgId ? { ...msg, content: msg.content + token } : msg
            )
          );
        }
      }

      setLastChatLatencyMs(Math.round(performance.now() - startedAt))
    } catch (error) {
      console.error('Chat generation failed:', error)
    } finally {
      setIsGeneratingChat(false)
    }
  }

  function exportSession() {
    const payload: ExportPayload = {
      exportedAt: nowIso(),
      transcript,
      suggestionBatches,
      chatHistory,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `synapseai-session-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handleStartSession() {
    setActiveView('session')
  }

  return (
    <div className="app-container">

      <div className="app-shell">
        <TopNav />
        
        {activeView === 'dashboard' ? (
          <Dashboard 
            onStartSession={handleStartSession}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <div className="session-view">
            <ControlBar
              isRecording={isRecording}
              isBusy={isBusy}
              transcriptCount={transcript.length}
              suggestionBatchCount={suggestionBatches.length}
              lastSuggestionLatencyMs={lastSuggestionLatencyMs}
              lastChatLatencyMs={lastChatLatencyMs}
              lastRefreshAt={lastRefreshAt}
              isLargeModel={isLargeModel}
              onToggleLargeModel={toggleLargeModel}
              onToggleRecording={toggleRecording}
              onManualRefresh={handleManualRefresh}
              onExport={exportSession}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />





            <main className="three-column-layout">
              <TranscriptPanel
                entries={transcript}
                isRecording={isRecording}
                isTranscribing={isTranscribing}
                userContext={userContext}
                onUserContextChange={setUserContext}
                slidingWindowContext={useMemo(() => {
                  const fiveMinsAgo = Date.now() - 300_000
                  const recent = transcript.filter(t => new Date(t.timestamp).getTime() > fiveMinsAgo)
                  return transcriptToContext(recent, recent.length)
                }, [transcript])}
              />

              <SuggestionsPanel
                batches={suggestionBatches}
                isLoading={isGeneratingSuggestions}
                isRecording={isRecording}
                lastRefreshAt={lastRefreshAt}
                refreshCadenceSeconds={suggestionCadenceSeconds}
                onSelectSuggestion={(item) => {
                  void answerFromSuggestion(item)
                }}
              />

              <ChatPanel
                messages={chatHistory}
                isLoading={isGeneratingChat}
                suggestionCadenceSeconds={suggestionCadenceSeconds}
                onSubmitQuestion={submitChatQuestion}
              />
            </main>

            <ApiTestLab
              apiKey={apiKey}
              chatModel={settings.generationModel}
              transcriptionModel={settings.transcriptionModel}
            />
          </div>
        )}

        <SettingsModal
          isOpen={isSettingsOpen}
          apiKey={apiKey}
          settings={settings}
          onApiKeyChange={setApiKey}
          onSettingsChange={setSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </div>
  )
}

export default App

function normalizeChunkText(chunkText: string, transcript: TranscriptEntry[]): string {
  const normalized = chunkText.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''

  const previousTail = transcript
    .slice(-2)
    .map((entry) => entry.text)
    .join(' ')
    .trim()

  if (!previousTail) return normalized

  const previousWords = tokenize(previousTail.toLowerCase())
  const currentWords = tokenize(normalized)
  const currentWordsLower = tokenize(normalized.toLowerCase())

  const maxOverlap = Math.min(14, previousWords.length, currentWordsLower.length)

  for (let overlap = maxOverlap; overlap >= 2; overlap -= 1) {
    const previousSuffix = previousWords.slice(-overlap).join(' ')
    const currentPrefix = currentWordsLower.slice(0, overlap).join(' ')

    if (previousSuffix === currentPrefix) {
      const deduped = currentWords.slice(overlap).join(' ').trim()
      return deduped
    }
  }

  return normalized
}

function tokenize(value: string): string[] {
  return value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
}

export default App
