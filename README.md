# Interview Mate AI

Vue 3 and Electron desktop interview copilot with Firebase login, live speech
recognition, authenticated Socket.IO sessions, persisted transcripts, and Groq
answer suggestions.

## Web Development

```bash
npm install
cp .env.example .env
npm run dev
```

## Desktop Development

Start the backend first, then run:

```bash
npm run dev:desktop
```

Electron enables microphone and display-media capture through a context-isolated
preload. Web Speech is the active recognition provider; Whisper and Deepgram can
implement the same provider interface later.

## Production Build

```bash
npm run build:desktop
npm run desktop
```

The production desktop command loads the generated `dist` and `dist-electron`
artifacts without requiring Vite.

## Environment

- `VITE_API_BASE_URL`: Express REST API, normally `http://localhost:8000/api`
- `VITE_SOCKET_URL`: Socket.IO server, normally `http://localhost:8000`
- Firebase web variables: public Firebase client configuration

Groq credentials belong only in the backend environment.
