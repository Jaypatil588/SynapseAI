import { afterEach, describe, expect, it, vi } from 'vitest'
import { groqChatCompletion, groqTranscribeAudio } from '../src/lib/groq'

describe('groqChatCompletion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the expected chat completion payload and returns assistant text', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hello from model' } }],
          }),
          { status: 200 },
        ),
      )

    const output = await groqChatCompletion({
      apiKey: 'test-key',
      model: 'openai/gpt-oss-120b',
      systemPrompt: 'system prompt',
      userPrompt: 'user prompt',
      temperature: 0.3,
    })

    expect(output).toBe('Hello from model')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    })

    const body = JSON.parse(String(init.body)) as {
      model: string
      temperature: number
      messages: Array<{ role: string; content: string }>
    }

    expect(body.model).toBe('openai/gpt-oss-120b')
    expect(body.temperature).toBe(0.3)
    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ])
  })

  it('throws a useful error when Groq returns a non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad request body', { status: 400 }),
    )

    await expect(
      groqChatCompletion({
        apiKey: 'test-key',
        model: 'openai/gpt-oss-120b',
        systemPrompt: 'system prompt',
        userPrompt: 'user prompt',
      }),
    ).rejects.toThrow('Groq chat failed (400): bad request body')
  })
})

describe('groqTranscribeAudio', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uploads multipart transcription payload and returns text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: 'transcribed text' }), {
        status: 200,
      }),
    )

    const blob = new Blob(['audio-bytes'], { type: 'audio/webm' })

    const output = await groqTranscribeAudio({
      apiKey: 'test-key',
      model: 'whisper-large-v3',
      audio: blob,
    })

    expect(output).toBe('transcribed text')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' })

    const formData = init.body as FormData
    expect(formData.get('model')).toBe('whisper-large-v3')
    expect(formData.get('temperature')).toBe('0')
    expect(formData.get('response_format')).toBe('verbose_json')

    const file = formData.get('file')
    expect(file).toBeInstanceOf(File)
    expect((file as File).name.endsWith('.webm')).toBe(true)
    expect((file as File).type).toBe('audio/webm')
  })

  it('throws a useful error when transcription call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('invalid media', { status: 400 }),
    )

    const blob = new Blob(['invalid'], { type: 'audio/ogg' })

    await expect(
      groqTranscribeAudio({
        apiKey: 'test-key',
        model: 'whisper-large-v3',
        audio: blob,
      }),
    ).rejects.toThrow('Groq transcription failed (400): invalid media')
  })
})
