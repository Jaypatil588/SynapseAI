import { describe, expect, it } from 'vitest'
import { groqChatCompletion, groqTranscribeAudio } from '../src/lib/groq'

const runLive = process.env.RUN_LIVE_GROQ_TESTS === '1'
const apiKey = process.env.VITE_GROQ_API_KEY ?? ''

const liveDescribe = runLive ? describe : describe.skip

liveDescribe('Groq live smoke tests', () => {
  it('chat completion works with gpt-oss model', async () => {
    if (!apiKey) {
      throw new Error('Missing VITE_GROQ_API_KEY for live tests.')
    }

    const text = await groqChatCompletion({
      apiKey,
      model: 'openai/gpt-oss-120b',
      systemPrompt: 'You are concise.',
      userPrompt: 'Respond with exactly: live-chat-ok',
      temperature: 0,
    })

    expect(text.toLowerCase()).toContain('live-chat-ok')
  }, 30_000)

  it('transcription endpoint accepts a valid wav file', async () => {
    if (!apiKey) {
      throw new Error('Missing VITE_GROQ_API_KEY for live tests.')
    }

    const wavBlob = createSilentWavBlob(1)

    const text = await groqTranscribeAudio({
      apiKey,
      model: 'whisper-large-v3',
      audio: wavBlob,
    })

    expect(typeof text).toBe('string')
  }, 45_000)
})

function createSilentWavBlob(seconds: number): Blob {
  const sampleRate = 16_000
  const channels = 1
  const bitsPerSample = 16
  const sampleCount = Math.max(1, Math.floor(sampleRate * seconds))
  const dataSize = sampleCount * channels * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true)
  view.setUint16(32, channels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}
