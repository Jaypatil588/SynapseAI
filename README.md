# TwinMind Live Suggestions Assignment (React + Vite)

A single-app web implementation of the April 2026 TwinMind coding assessment:
- Live mic transcription in chunks (~30s)
- Exactly 3 context-aware suggestions per refresh
- Click suggestion -> expanded answer in chat
- Continuous manual chat for the session
- Session export (transcript + suggestion batches + chat) with timestamps

## Stack
- React + TypeScript + Vite
- Browser `MediaRecorder` for chunked audio capture
- Groq API for:
  - Transcription: `whisper-large-v3`
  - Suggestions + Chat: `openai/gpt-oss-120b`

## Run locally
```bash
npm install
npm run dev
```

Open the app, click **Settings**, paste your Groq API key, then click **Start Mic**.

## Build
```bash
npm run build
npm run preview
```

## Tests
```bash
# Unit tests (mocked fetch, no network)
npm test

# Live Groq smoke tests (network + API key required)
RUN_LIVE_GROQ_TESTS=1 VITE_GROQ_API_KEY=your_key npm run test:live

# API probe (prints request body + response for chat + suggestions + transcription)
npm run probe:apis -- --audio /absolute/path/to/recording.wav
```

## Core product behavior
- Transcript panel appends chunks as transcription returns.
- Suggestions panel refreshes from recent transcript context and always stores new batches at top.
- Each batch has exactly 3 suggestions with types and short value-first previews.
- Clicking a suggestion sends it into chat and generates a detailed response.
- Manual chat uses transcript + recent chat context.
- Export downloads a single JSON session artifact.

## Prompt strategy
Three editable prompts are exposed in Settings:
1. **Live suggestions prompt**: forces diversity and strict JSON structure.
2. **Expanded answer prompt**: focused long-form answer when a suggestion is clicked.
3. **Chat prompt**: concise, context-grounded ongoing Q&A.

Defaults are intentionally practical but editable to support rapid prompt iteration during evaluation.

## Context window strategy
All context window sizes are editable in Settings:
- `liveSuggestionContextEntries`
- `expandedAnswerContextEntries`
- `chatContextEntries`

Current approach favors recent transcript lines for timeliness and latency.

## Latency + UX decisions
- Simple top-bar metrics track last suggestion/chat generation latency.
- Manual Refresh attempts to flush in-progress recorder audio first, then generates suggestions.
- UI keeps one continuous session in-memory and avoids persistence complexity.

## Tradeoffs
- API calls are client-side for speed of implementation and deployment simplicity.
- No auth/database/session persistence by design (aligned with assignment scope).
- JSON parsing for suggestions uses strict parsing with fallback suggestions if model output is malformed.

## Deploy
This app is Vercel-friendly as a static frontend deployment.
