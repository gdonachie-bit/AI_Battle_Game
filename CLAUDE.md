# AI Battle App — CLAUDE.md

## Repository

[github.com/gdonachie-bit/AI_Battle_Game](https://github.com/gdonachie-bit/AI_Battle_Game)

```bash
git add -A && git commit -m "message" && git push
```

## What This Is

A two-player hotseat battle game. Each player picks a concept (or selects from curated categories) and Claude Haiku decides the winner with an entertaining explanation. Runs entirely in the browser — no backend.

## Running the App

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

## Configuration

Create a `.env` file (never commit this):
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

The API key is exposed in browser network traffic — fine for personal/demo use. For public deployment, add a small backend proxy.

## Tech Stack

- **React 18 + TypeScript** via Vite
- **Framer Motion** — all animations and transitions
- **Lucide React** — icons
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude Haiku 4.5 for battle judgement

## Architecture

Single component file: `src/App.tsx` (~600 lines). No routing, no state library.

### Game Flow (4 states)

```
input → reveal (if chaos on) → loading → result
```

- **input** — configure arena (mode + chaos toggle) and pick combatants
- **reveal** — if chaos was opted in, the wildcard modifier is dramatically revealed for 2.6s before auto-advancing
- **loading** — BattleSimulation animation plays while two sequential Anthropic API calls run
- **result** — trophy, winner name, battle title, explanation, reason tags

### Two-Agent LLM Pattern

Two sequential calls per battle:
1. **Judge** (temp 0.3) — picks winner, returns `{ winner, reason_tags[] }`
2. **Commentator** (temp 0.7) — writes the narrative, returns `{ battle_title, explanation }`

Both prompts are in `decideBattle()`. The commentator receives the judge's output as context.

### Key State

| State | Purpose |
|-------|---------|
| `version` | `'raw'` (free text) or `'curated'` (dropdowns) |
| `mode` | `'Realistic'` / `'Funny'` / `'Strategic'` — changes both AI prompts |
| `wantsChaos` | Toggle; if true, a random wildcard is picked on Fight and revealed before battle |
| `revealModifier` | The wildcard string shown on the reveal screen and injected into both prompts |
| `fightConcept1/2` | Set at fight-start; used by BattleSimulation and executeBattle |

### Chaos Modifier Flow

`handleBattle` → if `wantsChaos`: pick random wildcard from `WILDCARDS[]`, set `revealModifier`, set `gameState = 'reveal'`. `ChaosReveal` auto-advances after 2.6s via `useEffect` → calls `handleRevealAdvance` → `executeBattle(p1, p2, modifier)`.

## Features

- **Raw mode** — free-text inputs, any concept
- **Curated mode** — 9 categories × 10-15 concepts each (Animals, Superheroes, Natural Disasters, Mythological Creatures, etc.)
- **3 arena modes** — Realistic, Funny, Strategic (different AI tone)
- **Chaos modifier** — 20 wildcards ("...in IKEA", "...after eating Chipotle", etc.) revealed dramatically before battle
- **Scoreboard** — P1/P2 wins, ties, streak counter
- **Battle History** — all rounds with titles and modifiers

## Model

`claude-haiku-4-5` — fast and cost-effective for short JSON responses. Change `CLAUDE_MODEL` constant in `src/App.tsx` to swap models.
