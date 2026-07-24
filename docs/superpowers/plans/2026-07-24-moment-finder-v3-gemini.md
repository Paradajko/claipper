# Moment Finder v3 Gemini implementation plan

1. Add provider configuration tests for the Gemini OpenAI-compatible endpoint,
   configurable model, and required API key.
2. Add worker environment and startup-report tests that distinguish Gemini text
   analysis from OpenAI transcription.
3. Route all four Moment Finder text calls through the Gemini client while
   leaving the OpenAI transcription request unchanged.
4. Update example environment files and worker operations documentation.
5. Run unit tests, typecheck, lint, build, syntax checks, and `git diff --check`.
6. Commit and push `codex/moment-finder-v3-gemini` without merging `main`.

