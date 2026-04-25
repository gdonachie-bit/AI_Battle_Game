# AI Battle Arena

Free-form 2-player battle game inspired by rock-paper-scissors.

Players type any concept (e.g., `tornado`, `earthquake`, `pizza`) and AI decides who wins with an explanation.

## Local development

1. `npm install`
2. `npm run dev`
3. Open the URL shown (usually http://localhost:5173)

## Gameplay

- Player 1 enters their concept, presses `Ready` to pass to Player 2.
- Player 2 enters their concept, then clicks `Fight!`.
- AI compares both with rule-based and heuristic scoring.
- Winner, reason, score counters, streak, and history update.
- Online mode is planned (placeholder in UI) for future friend-match rooms.

## Extending for online play

- Add a back-end (Socket.io / WebRTC + room management).
- Save game state and history to shared backend.
- Use a real AI model API for dynamic verdict text (OpenAI or custom).