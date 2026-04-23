#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = 'https://api.groq.com/openai/v1'

const args = parseArgs(process.argv.slice(2))
const apiKey = args.key || process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY || ''
const chatModel = args.model || 'openai/gpt-oss-120b'
const transcriptionModel = args.transcribeModel || 'whisper-large-v3'

if (!apiKey) {
  console.error('Missing API key. Pass --key <gsk_...> or set VITE_GROQ_API_KEY.')
  process.exit(1)
}

if (!args.audio) {
  console.error('Missing audio file. Pass --audio /absolute/path/to/file')
  process.exit(1)
}

const audioPath = path.resolve(args.audio)

await run()

async function run() {
  console.log('=== GROQ API PROBE START ===')
  console.log(`Chat model: ${chatModel}`)
  console.log(`Transcription model: ${transcriptionModel}`)
  console.log(`Audio file: ${audioPath}`)
  console.log('')

  await probeChatBasic()
  await probeChatJsonSuggestion()
  await probeTranscription()

  console.log('')
  console.log('=== GROQ API PROBE COMPLETE ===')
}

async function probeChatBasic() {
  const endpoint = `${BASE_URL}/chat/completions`
  const requestBody = {
    model: chatModel,
    temperature: 0,
    messages: [
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Reply with exactly: chat-basic-ok' },
    ],
  }

  await callJsonEndpoint('1) chat/completions (basic)', endpoint, requestBody)
}

async function probeChatJsonSuggestion() {
  const endpoint = `${BASE_URL}/chat/completions`
  const requestBody = {
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

  await callJsonEndpoint('2) chat/completions (suggestion JSON)', endpoint, requestBody)
}

async function probeTranscription() {
  const endpoint = `${BASE_URL}/audio/transcriptions`

  const audioBuffer = await fs.readFile(audioPath)
  const mimeType = mimeFromExt(audioPath)
  const fileName = path.basename(audioPath)

  const formData = new FormData()
  formData.append('model', transcriptionModel)
  formData.append('temperature', '0')
  formData.append('response_format', 'verbose_json')
  formData.append('file', new File([audioBuffer], fileName, { type: mimeType }))

  console.log('--- 3) audio/transcriptions ---')
  console.log('Request:')
  console.log(
    JSON.stringify(
      {
        method: 'POST',
        endpoint,
        headers: { Authorization: 'Bearer ***redacted***' },
        formData: {
          model: transcriptionModel,
          temperature: '0',
          response_format: 'verbose_json',
          file: {
            name: fileName,
            mimeType,
            bytes: audioBuffer.byteLength,
          },
        },
      },
      null,
      2,
    ),
  )

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    const raw = await response.text()
    console.log('Response status:', response.status)
    console.log('Response body:')
    printJsonOrText(raw)
  } catch (error) {
    console.log('Request failed:', error instanceof Error ? error.message : String(error))
  }
}

async function callJsonEndpoint(label, endpoint, requestBody) {
  console.log(`--- ${label} ---`)
  console.log('Request:')
  console.log(
    JSON.stringify(
      {
        method: 'POST',
        endpoint,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ***redacted***',
        },
        body: requestBody,
      },
      null,
      2,
    ),
  )

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    const raw = await response.text()
    console.log('Response status:', response.status)
    console.log('Response body:')
    printJsonOrText(raw)
  } catch (error) {
    console.log('Request failed:', error instanceof Error ? error.message : String(error))
  }

  console.log('')
}

function printJsonOrText(raw) {
  try {
    const parsed = JSON.parse(raw)
    console.log(JSON.stringify(parsed, null, 2))
  } catch {
    console.log(raw)
  }
}

function parseArgs(argv) {
  const out = {}

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'
    out[key] = value

    if (value !== 'true') i += 1
  }

  return out
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.m4a') return 'audio/mp4'
  if (ext === '.mp4') return 'audio/mp4'
  if (ext === '.ogg' || ext === '.oga') return 'audio/ogg'
  if (ext === '.webm') return 'audio/webm'
  return 'application/octet-stream'
}
