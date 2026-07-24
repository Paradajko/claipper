# Moment Finder v3: Gemini text analysis

## Goal

Keep the existing Moment Finder v3 pipeline and move only its text analysis,
ranking, and timestamp verification calls from OpenAI chat completions to Gemini.
OpenAI Whisper remains responsible for word-level transcription.

## Provider boundary

- `GEMINI_API_KEY` authenticates Moment Finder text requests.
- `GEMINI_MODEL` selects the Gemini text model.
- Gemini is called through Google's official OpenAI-compatible endpoint.
- `OPENAI_API_KEY` remains required only for transcription.
- `OPENAI_TRANSCRIBE_MODEL` continues to select the transcription model.
- `OPENAI_MODEL` is removed from worker configuration.

## Scope

The prompts, candidate schema, local ranking, transcript grounding, Kick chat
signals, rendering, storage, UI, and database schema remain unchanged.

No real Gemini request and no real video processing are part of automated
verification.

