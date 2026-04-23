import { useEffect, useMemo, useRef, useState } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { ControlBar } from './components/ControlBar'
import { SettingsModal } from './components/SettingsModal'
import { SuggestionsPanel } from './components/SuggestionsPanel'
import { TranscriptPanel } from './components/TranscriptPanel'
import { Dashboard } from './components/Dashboard'
import { TopNav } from './components/TopNav'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './lib/defaults'
import { groqChatCompletion, groqStreamChatCompletion, groqTranscribeAudio } from './lib/groq'
import {
  fallbackSuggestions,
  isCommonWhisperHallucination,
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
  SuggestionBatch,
  SuggestionItem,
  TranscriptEntry,
} from './types'
import './index.css'


function App() {
  const [apiKey, setApiKey] = useState('')
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return DEFAULT_SETTINGS

    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<AppSettings>) }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isLargeModel, setIsLargeModel] = useState(settings.generationModel === 'openai/gpt-oss-120b')
  const [transcribeLanguage, setTranscribeLanguage] = useState<'en' | 'auto'>('en')
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
  
  const pendingManualRefreshRef = useRef(false)

  const apiKeyRef = useRef(apiKey)
  const settingsRef = useRef(settings)
  const transcribeLanguageRef = useRef(transcribeLanguage)
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
    transcribeLanguageRef.current = transcribeLanguage
  }, [transcribeLanguage])

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

      const systemPrompt = `You are a precision transcript archivist. Your job is to create and maintain a dense, factual running summary of meeting transcript content that has overflowed the active context window. This summary will be injected into future LLM context to compensate for lost history — accuracy is critical.

PRESERVE — extract and keep ALL of the following:
- Named entities: people (full names + roles if mentioned), companies, products, systems, tools
- Concrete numbers: dates, deadlines, timelines, budgets, metrics, version numbers
- Explicit decisions: "we decided", "agreed to", "confirmed that", "rejected", "approved"
- Action items and owners: who committed to do what and by when
- Key topics discussed and their resolution status (resolved / unresolved / deferred)
- Important claims, assertions, or positions taken by any party

DISCARD — do NOT include:
- Small talk, pleasantries, filler phrases
- Repetition or restatements of the same point
- Pure hypotheticals unless explicitly agreed upon
- Transitional phrases and meta-commentary

FORMAT RULES:
- Write in telegraphic, dense style — omit articles and filler where meaning is preserved
- Group related items under topic clusters
- Max 400 words total
- Never write "the transcript says" — just state the facts directly
- If updating an existing summary, integrate new content chronologically without duplicating`;
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

      const handleDataAvailable = (event: BlobEvent) => {
        if (!event.data || event.data.size < 1000) return 
        enqueueTranscriptionChunk(event.data)
      }

      const options = { mimeType: 'audio/webm' }
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = handleDataAvailable

      const sliceAndResetChunk = () => {
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
      }

      // Fixed 10-second hardware interval
      chunkIntervalRef.current = window.setInterval(sliceAndResetChunk, 10000)



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
            language: transcribeLanguageRef.current,
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

      let extendedSystemPrompt = `You are SynapseAI — a real-time meeting intelligence layer. Analyze the transcript and generate exactly ONE suggestion per type (5 total), plus a typeRanking that reflects which types are most relevant to the current conversational moment.

ANALYSIS RULES:
- Focus on the MOST RECENT 60–120 seconds of transcript, not the full history
- A great suggestion is triggered by something SPECIFIC that was just said — name it
- Prioritize unresolved threads, implicit assumptions, unchallenged claims, and missed follow-ups
- Generic advice ("ask for clarification") is a failure — be surgical and concrete

SUGGESTION TYPES — generate exactly one of each:
- question_to_ask: The single best question the user should pose to the other party RIGHT NOW
- talking_point: A specific fact, counterpoint, or angle worth introducing into the conversation
- answer: A direct response to something that was asked or left hanging in the transcript
- fact_check: A specific claim worth verifying — name the claim and source of doubt
- clarification: The most critical ambiguity that is blocking progress if left undefined

TYPE RANKING — rank all 5 types by relevance to THIS specific conversational moment:
- Consider user intent (what is the user trying to achieve?), meeting phase, and what just happened
- Rank 1 = most relevant right now, Rank 5 = least relevant right now
- Base ranking on: current topic complexity, volume of unresolved questions, claim density, and ambiguity level

OUTPUT RULES:
- Return ONLY valid JSON — no markdown fences, no explanation, no preamble
- Exactly 5 suggestion objects, one per type
- preview: max 140 chars — self-contained, usable word-for-word without reading the transcript
- whyNow: max 100 chars — reference the specific conversational trigger (a word, phrase, or moment)
- rank in suggestions must match typeRanking values

SCHEMA (strict):
{
  "typeRanking": {
    "question_to_ask": <1-5>,
    "talking_point": <1-5>,
    "answer": <1-5>,
    "fact_check": <1-5>,
    "clarification": <1-5>
  },
  "suggestions": [
    {"type": "question_to_ask", "preview": "...", "whyNow": "...", "rank": <1-5>},
    {"type": "talking_point", "preview": "...", "whyNow": "...", "rank": <1-5>},
    {"type": "answer", "preview": "...", "whyNow": "...", "rank": <1-5>},
    {"type": "fact_check", "preview": "...", "whyNow": "...", "rank": <1-5>},
    {"type": "clarification", "preview": "...", "whyNow": "...", "rank": <1-5>}
  ]
}`;
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
    setIsLargeModel(prev => !prev)
    setSettings((prev) => ({
      ...prev,
      generationModel: !isLargeModel
        ? 'openai/gpt-oss-120b'
        : 'openai/gpt-oss-20b'
    }))
  }

  function toggleLanguage() {
    setTranscribeLanguage(prev => prev === 'en' ? 'auto' : 'en')
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
      `${suggestion.preview}`,
      '',
      `Transcript:`,
      transcriptContext,
      '',
      `Again, answer the following question: ${suggestion.preview}`,
    ].join('\n')

    const systemPrompt = `You are SynapseAI, a world-class research assistant and trusted second brain. Your objective is to help the user deeply understand the topic they selected.

Format your response exactly into these two sections:

### From the transcript
Provide a direct answer based exclusively on the provided meeting transcript. Cite specific lines where possible. If the transcript does not contain the answer, state that.

### More details
Use your internet search capabilities to generate a thorough, detailed, and expansive response that supplements the transcript context with real-world knowledge.`;

    const effort = (suggestion.type === 'fact_check' || suggestion.type === 'answer') ? 'high' : 'medium'
    await generateAssistantChat(prompt, systemPrompt, effort)
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

    const systemPrompt = `You are SynapseAI, a world-class research assistant and trusted second brain. Your objective is to answer the user's free-form chat query.

Format your response exactly into these two sections:

### From the transcript
Provide a direct answer based exclusively on the provided meeting transcript. Cite specific lines where possible. If the transcript does not contain the answer, state that.

### More details
Use your internet search capabilities to generate a thorough, detailed, and expansive response that supplements the transcript context with real-world knowledge.`;

    await generateAssistantChat(prompt, systemPrompt, 'high')
  }

  async function generateAssistantChat(prompt: string, systemPrompt: string, reasoningEffort: 'low' | 'medium' | 'high' = 'low') {
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
        systemPrompt: systemPrompt,
        userPrompt: prompt,
        temperature: 0.8,
        reasoningEffort,
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
    const lines: string[] = []

    lines.push(`SYNAPSEAI SESSION EXPORT`)
    lines.push(`Exported At: ${new Date().toLocaleString()}`)
    lines.push(``)
    lines.push(`=========================================`)
    lines.push(``)

    lines.push(`TRANSCRIPT`)
    lines.push(``)
    if (transcript.length === 0) {
      lines.push(`No transcript recorded.`)
    } else {
      for (const entry of transcript) {
        const time = new Date(entry.timestamp).toLocaleTimeString()
        lines.push(`[${time}] ${entry.text}`)
      }
    }
    lines.push(``)
    lines.push(`=========================================`)
    lines.push(``)

    lines.push(`LIVE SUGGESTIONS`)
    lines.push(``)
    if (suggestionBatches.length === 0) {
      lines.push(`No suggestions generated.`)
    } else {
      // Print in chronological order (batches are stored newest first)
      const sortedBatches = [...suggestionBatches].reverse()
      for (const batch of sortedBatches) {
        const time = new Date(batch.timestamp).toLocaleTimeString()
        lines.push(`--- Batch ${batch.batchNumber} (${time}) ---`)
        for (const item of batch.items) {
          lines.push(`[${item.type.toUpperCase()}] ${item.preview}`)
        }
        lines.push(``)
      }
    }
    lines.push(`=========================================`)
    lines.push(``)

    lines.push(`CHAT HISTORY`)
    lines.push(``)
    if (chatHistory.length === 0) {
      lines.push(`No chat history.`)
    } else {
      for (const msg of chatHistory) {
        const time = new Date(msg.timestamp).toLocaleTimeString()
        lines.push(`${msg.role === 'user' ? 'USER' : 'ASSISTANT'} [${time}]:`)
        lines.push(msg.content)
        lines.push(``)
      }
    }

    const textPayload = lines.join('\n')
    const blob = new Blob([textPayload], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `synapseai-session-${Date.now()}.txt`
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
              transcribeLanguage={transcribeLanguage}
              onToggleLargeModel={toggleLargeModel}
              onToggleLanguage={toggleLanguage}
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

          </div>
        )}

        <SettingsModal
          isOpen={isSettingsOpen}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
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
  if (isCommonWhisperHallucination(normalized)) return ''

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

