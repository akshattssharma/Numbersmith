# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                                    # dev server, http://localhost:5173
npm test                                        # vitest run — the whole suite
npx vitest run src/engine/__tests__/session.test.ts   # a single test file
npx vitest run -t "test name substring"         # a single test by name
npm run test:watch                              # vitest in watch mode
npx tsc --noEmit                                # typecheck only (build also does this via `tsc -b`)
npm run build                                   # tsc -b --noEmit && vite build -> dist/
npm run sim                                     # tsx scripts/divergence.ts — runs the five-children thesis simulation standalone
```

Node 22 is required (Vite 7 needs `^20.19.0 || >=22.12.0`; CI pins Node 22 explicitly because plain "20" is unreliable). No API keys, no backend, no `.env` needed to develop — the whole engine runs client-side and deterministically.

CI (`.github/workflows/deploy.yml`) runs `npx tsc --noEmit`, `npm test`, then `npx vite build` with `VITE_BASE` derived from the repo name, and deploys `dist/` to GitHub Pages on push to `main`/`master`. A PR gets the same build+test steps without the deploy.

## Architecture

Numbersmith is a from-scratch adaptive maths tutor for grades 2-3 (14 concepts: number sense through multiplication foundations). The one architectural rule everything else follows: **the engine decides, the UI renders.**

- **`src/engine/`** — the entire intelligence layer. Zero React, zero DOM. Every file here is a pure function or a plain class over plain data, and is fully unit-testable without a browser. This is deliberate portability: the engine should survive a different renderer.
- **`src/components/`** and **`src/screens/`** — thin renderers. A screen reads what the engine already decided (`session.quest`, `turn.selection`, `turn.line`, `TurnResult` fields) and displays it; it does not itself decide what to teach, what to say, or when something is "done." If you find yourself writing pedagogy or a decision branch in a `.tsx` file, it almost certainly belongs in `src/engine/` instead.

### The core loop

`session.ts`'s `Session` class is the orchestrator for everything below. One `Session` exists per active child (see `App.tsx`), constructed from a persisted `ChildSave` and rebuilt only when the active child changes.

```
play -> observe -> diagnose -> update the model -> re-derive the policy
     -> choose the next thing -> teach if needed -> repeat
```

- `session.nextTurn()` calls `selector.ts`'s `selectNext()`, which walks an ordered decision tree (most urgent first): resolve a confirmed misconception > disambiguate two candidate bugs > repair a blocking prerequisite > spaced review > move into the frontier concept > probe a neglected representation > vary kind if one interaction has repeated too long. Every selection carries a one-sentence `rationale`, surfaced in The Brain (parent view) — nothing the engine does is a black box to the builder, even though none of it reaches the child.
- `session.submit()` runs `diagnose()` + `recordAttempt()` (`learnerModel.ts`) to update per-concept Bayesian knowledge tracing (BKT) and behavioural traits (strategy, impulsivity, frustration, confidence, stamina, inferred from latency/churn/hints, never self-reported), closes the loop on the struggle controller (`struggle.ts`, a PI controller with online bias correction), and returns a `TurnResult` with everything that happened: the diagnosis, the next companion line, and any of three transitions that just occurred (`starsEarned`, `collectionGained`, `newlyMastered`/`newlyReady`) computed by comparing model state before/after the attempt.

### Concept graph and the representation delta

`conceptGraph.ts` defines the 14 concepts with prerequisites — this is what lets the selector ask "which prerequisite is actually missing?" instead of just re-serving the same concept. Every concept can be presented on three surfaces (`Representation` in `types.ts`): **manipulative** (bundles you build/break via `BundleBoard.tsx` or drag via `GatherBoard.tsx`), **symbolic** (typed numbers), **story** (a personalized word problem, `storyTemplates.ts`). Comparing performance *between* surfaces on the *same* concept — not just accuracy — is how the system tells "can't do subtraction" apart from "can't read the question." The opening six items of a child's lifetime (`calibrationPlan()` in `session.ts`, gated on `model.history.length` so it never replays) deliberately interleave surfaces to seed this.

### Shape: quest and sitting

`quest.ts` wraps the raw item stream so a play session has a beginning, middle and end instead of running forever: items are grouped into a **quest** (a stated goal, a meter that fills on effort regardless of correctness, a designed win reserved for its last item), and quests are grouped into a **sitting**, which ends the moment a quest concludes if the child's own stamina estimate or the frustration safety valve says it should. `Session` tracks `quest`/`questNumber`/`sittingEnded`; `Play.tsx` only ever renders what it finds there.

### Reward tiers

Three facts the engine already produces every turn — a correct answer, a concluded quest, a concept crossing its mastery threshold — are made visible via `TurnResult`, rather than computed again in the UI: a lifetime star count, a per-world collection (`WorldCollection.tsx`), and a kid-safe mastery constellation over the concept graph (`Constellation.tsx`), all reachable from `ProgressOverlay.tsx` and choreographed with flight animations (`RewardFlight.tsx`). Stars and collection are persisted lifetime fields on `ChildSave`/`Session`, not local component state.

### Household and persistence

`household.ts` is the only persistence layer — everything lives in `localStorage`, on-device, nothing is sent anywhere. One `Household` (a PIN, a roster of children) plus one `ChildSave` per child (their `LearnerModel`, struggle state, quest/sitting state, stars, collection). `withDefaults()` migrates old saves forward field-by-field as new save fields are added — when adding a new persisted field, extend `ChildSave`, `newChildSave()`, and `withDefaults()` together, or an old save silently loses it.

### Safety architecture (see README "Safety is an architecture, not a filter")

The companion (`companion.ts`) never holds an open-ended conversation with a child: the engine chooses the intent and content of every line from a bounded template bank; an optional model call may only *rephrase* inside a length cap, a banned-phrase list and a post-generation gate, falling back to the written line on any failure. The parent view is a fixed question list, not a chat box. No accuracy percentage is ever shown to a child — only `session.stars`, a streak, and (via the Brain view) the same kind of plain-language findings a parent gets.

## Where to look first

- `README.md` — the full "Findings from building it" log (15 entries as of this writing) documents every non-obvious bug and the reasoning behind fixes already made; check it before re-deriving something that was already tried and found wrong.
- `docs/PRODUCT_PLAN.md` — thesis, scope (grade 2-3, 14 concepts, deliberately not K-5), and what's deliberately not built yet.
- `src/engine/__tests__/divergence.test.ts` + `scripts/divergence.ts` + `screens/FiveChildren.tsx` — the product's central thesis (adapting the whole experience, not just difficulty, changes outcomes) expressed as five simulated learner personas and asserted in CI, not just claimed.
