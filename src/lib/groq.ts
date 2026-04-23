import Groq from 'groq-sdk'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

type ChatOptions = {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  temperature?: number
}

export async function groqChatCompletion({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
}: ChatOptions): Promise<string> {
  console.log(`[groqChatCompletion] Request started... Model: ${model}, Temperature: ${temperature}`);
  console.log(`[groqChatCompletion] System Prompt: ${systemPrompt}`);
  console.log(`[groqChatCompletion] User Prompt: ${userPrompt}`);
  
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    const details = await safeText(response)
    const errObj = new Error(`Groq chat failed (${response.status}): ${details}`);
    console.error(`[groqChatCompletion] HTTP Error!`, errObj);
    throw errObj
  }

  console.log(`[groqChatCompletion] HTTP Response OK, status: ${response.status}`);

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    console.warn('[groqChatCompletion] Empty response from server.', data);
    throw new Error('Groq chat returned an empty response.')
  }

  console.log(`[groqChatCompletion] Received structured content:\n${content}`);

  return content
}


export async function groqStreamChatCompletion({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  isHighComplexity = false
}: ChatOptions & { isHighComplexity?: boolean }) {
  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })
  
  const tools = isHighComplexity ? [{ type: 'browser_search' as const }] : undefined;
  
  return await client.chat.completions.create({
    model,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_completion_tokens: isHighComplexity ? 8192 : 2048,
    top_p: 1,
    reasoning_effort: isHighComplexity ? 'high' : 'low',
    stream: true,
    stop: null,
    tools: tools as any
  })
}

export async function groqTranscribeAudio({
  apiKey,
  model,
  audio,
  prompt,
}: {
  apiKey: string
  model: string
  audio: Blob
  prompt?: string
}): Promise<string> {
  console.log(`[groqTranscribeAudio] Starting transcription. Model: ${model}, Audio Blob Size: ${audio.size}, Audio Blob Type: ${audio.type || 'unknown'}`);
  
  const formData = new FormData()
  formData.append('model', model)
  formData.append('temperature', '0.9')
  formData.append('response_format', 'verbose_json')
  if (prompt) {
    formData.append('prompt', prompt)
  }
  const contentType = 'audio/webm' 
  const extension = 'webm'
  const filename = `chunk-${Date.now()}.${extension}`
  const file = new File([audio], filename, { type: contentType })
  formData.append('file', file)

  console.log(`[groqTranscribeAudio] Filename created: ${filename}`);

  const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const details = await safeText(response)
    const errObj = new Error(`Groq transcription failed (${response.status}): ${details}`);
    console.error(`[groqTranscribeAudio] HTTP Error!`, errObj);
    throw errObj
  }

  console.log(`[groqTranscribeAudio] HTTP Response OK, status: ${response.status}`);

  const data = (await response.json()) as { text?: string }
  const finalText = data.text?.trim() ?? ''
  
  console.log(`[groqTranscribeAudio] Final transcribed text: "${finalText}"`);
  return finalText
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return 'Unable to read error body.'
  }
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('m4a')) return 'm4a'
  return 'webm'
}
