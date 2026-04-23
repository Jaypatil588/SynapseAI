import { useMemo, useRef, useState } from 'react'

type ApiTestLabProps = {
  apiKey: string
  chatModel: string
  transcriptionModel: string
}

type ProbeLog = {
  id: string
  label: string
  request: unknown
  status: number | null
  response: unknown
  createdAt: string
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

export function ApiTestLab({ apiKey, chatModel, transcriptionModel }: ApiTestLabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [recordingSource, setRecordingSource] = useState<'mic' | 'system'>('mic')
  const [logs, setLogs] = useState<ProbeLog[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])
  const sampleRateRef = useRef(16_000)

  const swaggerSpec = useMemo(() => buildSwaggerSpec(chatModel), [chatModel])
  const swaggerHtml = useMemo(
    () => buildSwaggerHtml(swaggerSpec, apiKey.trim()),
    [swaggerSpec, apiKey],
  )

  function addLog(log: Omit<ProbeLog, 'id' | 'createdAt'>) {
    setLogs((previous) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        ...log,
      },
      ...previous,
    ])
  }

  async function startMicRecording() {
    await startRecording('mic')
  }

  async function startSystemRecording() {
    await startRecording('system')
  }

  async function startRecording(source: 'mic' | 'system') {
    if (isRecording) return

    try {
      const stream =
        source === 'mic'
          ? await navigator.mediaDevices.getUserMedia({ audio: true })
          : await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })

      const hasAudioTrack = stream.getAudioTracks().length > 0
      if (!hasAudioTrack) {
        stream.getTracks().forEach((track) => track.stop())
        addLog({
          label: 'recording/error',
          request: { action: `start-${source}-recording` },
          status: null,
          response: {
            error:
              'No audio track captured. For tab audio, select a tab/window and enable audio sharing in the picker.',
          },
        })
        return
      }

      mediaStreamRef.current = stream
      pcmChunksRef.current = []
      setRecordingSource(source)

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      sampleRateRef.current = audioContext.sampleRate

      const sourceNode = audioContext.createMediaStreamSource(stream)
      sourceNodeRef.current = sourceNode

      const processorNode = audioContext.createScriptProcessor(4096, 1, 1)
      processorNodeRef.current = processorNode

      processorNode.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        pcmChunksRef.current.push(new Float32Array(input))
      }

      sourceNode.connect(processorNode)
      processorNode.connect(audioContext.destination)
      setIsRecording(true)
    } catch (error) {
      addLog({
        label: 'recording/error',
        request: { action: `start-${source}-recording` },
        status: null,
        response: { error: getErrorMessage(error) },
      })
    }
  }

  function stopRecording() {
    if (!isRecording) return

    processorNodeRef.current?.disconnect()
    sourceNodeRef.current?.disconnect()
    processorNodeRef.current = null
    sourceNodeRef.current = null

    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null

    const mergedSamples = mergeFloat32Arrays(pcmChunksRef.current)
    const wavBuffer = encodeWav(mergedSamples, sampleRateRef.current)
    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' })
    setAudioBlob(wavBlob)

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    setAudioUrl(URL.createObjectURL(wavBlob))
    setIsRecording(false)
  }

  async function runChatBasicProbe() {
    const body = {
      model: chatModel,
      temperature: 0,
      messages: [
        { role: 'system', content: 'You are concise.' },
        { role: 'user', content: 'Reply with exactly: chat-basic-ok' },
      ],
    }

    await runJsonProbe('chat/completions/basic', `${GROQ_BASE_URL}/chat/completions`, body)
  }

  async function runChatSuggestionProbe() {
    const body = {
      model: chatModel,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Return strict JSON only in the form {"suggestions":[{"type":"...","preview":"...","whyNow":"..."},{...},{...}]}.',
        },
        {
          role: 'user',
          content:
            'Transcript context: [10:00:01] We need to decide launch date. [10:00:12] QA found 3 critical bugs. [10:00:20] Marketing needs one week notice. Generate exactly 3 suggestions.',
        },
      ],
    }

    await runJsonProbe('chat/completions/suggestions', `${GROQ_BASE_URL}/chat/completions`, body)
  }

  async function runTranscriptionProbe() {
    if (!audioBlob) {
      addLog({
        label: 'audio/transcriptions/error',
        request: { note: 'no audio recorded' },
        status: null,
        response: { error: 'Record audio first.' },
      })
      return
    }

    if (!apiKey.trim()) {
      addLog({
        label: 'audio/transcriptions/error',
        request: { note: 'missing API key' },
        status: null,
        response: { error: 'Missing API key in Settings.' },
      })
      return
    }

    setIsRunning(true)

    const formData = new FormData()
    formData.append('model', transcriptionModel)
    formData.append('temperature', '0')
    formData.append('response_format', 'verbose_json')

    const filename = `recorded-${Date.now()}.wav`
    const file = new File([audioBlob], filename, { type: 'audio/wav' })
    formData.append('file', file)

    const requestBodySummary = {
      method: 'POST',
      endpoint: `${GROQ_BASE_URL}/audio/transcriptions`,
      headers: { Authorization: 'Bearer ***redacted***' },
      formData: {
        model: transcriptionModel,
        temperature: '0',
        response_format: 'verbose_json',
        file: {
          name: file.name,
          type: file.type,
          bytes: file.size,
        },
      },
    }

    try {
      const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        body: formData,
      })

      const raw = await response.text()
      addLog({
        label: 'audio/transcriptions',
        request: requestBodySummary,
        status: response.status,
        response: tryParseJson(raw),
      })
    } catch (error) {
      addLog({
        label: 'audio/transcriptions',
        request: requestBodySummary,
        status: null,
        response: { error: getErrorMessage(error) },
      })
    } finally {
      setIsRunning(false)
    }
  }

  async function runJsonProbe(label: string, endpoint: string, body: unknown) {
    if (!apiKey.trim()) {
      addLog({
        label,
        request: { endpoint, body },
        status: null,
        response: { error: 'Missing API key in Settings.' },
      })
      return
    }

    setIsRunning(true)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(body),
      })

      const raw = await response.text()

      addLog({
        label,
        request: {
          method: 'POST',
          endpoint,
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ***redacted***',
          },
          body,
        },
        status: response.status,
        response: tryParseJson(raw),
      })
    } catch (error) {
      addLog({
        label,
        request: {
          method: 'POST',
          endpoint,
          body,
        },
        status: null,
        response: { error: getErrorMessage(error) },
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <section className="api-test-lab">
      <header>
        <h2>API Test Lab</h2>
        <button onClick={() => setIsOpen((previous) => !previous)}>
          {isOpen ? 'Hide' : 'Open'}
        </button>
      </header>

      {isOpen ? (
        <div className="api-test-lab__body">
          <div className="api-test-lab__controls">
            <div className="api-test-lab__group">
              <h3>WAV Recorder (for transcription)</h3>
              <div className="button-row">
                <button onClick={startMicRecording} disabled={isRecording || isRunning}>
                  Start Mic Recording
                </button>
                <button onClick={startSystemRecording} disabled={isRecording || isRunning}>
                  Start Tab/System Recording
                </button>
                <button onClick={stopRecording} disabled={!isRecording || isRunning}>
                  Stop Recording
                </button>
                <button onClick={runTranscriptionProbe} disabled={!audioBlob || isRecording || isRunning}>
                  Hit Transcription API
                </button>
              </div>
              {audioUrl ? <audio controls src={audioUrl} /> : <p>No audio captured yet.</p>}
              {audioBlob ? <p>Recorded WAV bytes: {audioBlob.size}</p> : null}
              {isRecording ? (
                <p>Recording source: {recordingSource === 'mic' ? 'Microphone' : 'Tab/System audio'}</p>
              ) : null}
              <p>
                For YouTube/tab audio recording: choose <strong>Start Tab/System Recording</strong> and
                enable audio sharing in the browser picker.
              </p>
            </div>

            <div className="api-test-lab__group">
              <h3>Chat Probes</h3>
              <div className="button-row">
                <button onClick={runChatBasicProbe} disabled={isRunning}>
                  Hit Chat API (Basic)
                </button>
                <button onClick={runChatSuggestionProbe} disabled={isRunning}>
                  Hit Chat API (Suggestions)
                </button>
              </div>
            </div>
          </div>

          <div className="api-test-lab__logs">
            <h3>Request / Response Logs</h3>
            {logs.length === 0 ? (
              <p>No logs yet. Run a probe.</p>
            ) : (
              logs.map((log) => (
                <article key={log.id} className="api-log-card">
                  <header>
                    <strong>{log.label}</strong>
                    <span>Status: {log.status ?? 'request-failed'}</span>
                  </header>
                  <details open>
                    <summary>Request</summary>
                    <pre>{JSON.stringify(log.request, null, 2)}</pre>
                  </details>
                  <details open>
                    <summary>Response</summary>
                    <pre>{JSON.stringify(log.response, null, 2)}</pre>
                  </details>
                </article>
              ))
            )}
          </div>

          <div className="api-test-lab__swagger">
            <h3>Swagger UI (chat endpoints)</h3>
            <p>
              Chat endpoints are available in Swagger. Transcription testing uses the WAV recorder
              buttons above (no file upload needed).
            </p>
            <iframe
              className="swagger-frame"
              title="Swagger UI"
              srcDoc={swaggerHtml}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return { raw: value }
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function mergeFloat32Arrays(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataLength = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return buffer
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

function buildSwaggerSpec(chatModel: string) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Groq API Test Surface',
      version: '1.0.0',
      description: 'Minimal OpenAPI for chat and transcription probes.',
    },
    servers: [{ url: GROQ_BASE_URL }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
      schemas: {
        ChatMessage: {
          type: 'object',
          properties: {
            role: { type: 'string', example: 'user' },
            content: { type: 'string', example: 'Hello' },
          },
          required: ['role', 'content'],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/chat/completions': {
        post: {
          summary: 'Chat completion',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    model: { type: 'string', example: chatModel },
                    temperature: { type: 'number', example: 0.3 },
                    messages: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ChatMessage' },
                    },
                  },
                  required: ['model', 'messages'],
                },
              },
            },
          },
          responses: {
            '200': { description: 'Successful response' },
          },
        },
      },
      // Intentionally excluded from Swagger UI in this app:
      // /audio/transcriptions is exercised via the WAV recorder controls above.
    },
  }
}

function buildSwaggerHtml(spec: unknown, apiKey: string): string {
  const serializedSpec = JSON.stringify(spec)
  const serializedApiKey = JSON.stringify(apiKey)

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
    <style>
      html, body, #swagger-ui { margin: 0; padding: 0; height: 100%; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script>
      const spec = ${serializedSpec};
      const apiKey = ${serializedApiKey};
      window.ui = SwaggerUIBundle({
        spec,
        dom_id: '#swagger-ui',
        docExpansion: 'list',
        defaultModelsExpandDepth: -1,
        requestInterceptor: (req) => {
          req.headers = req.headers || {};
          if (apiKey) req.headers.Authorization = 'Bearer ' + apiKey;
          return req;
        }
      });
    </script>
  </body>
</html>`
}
