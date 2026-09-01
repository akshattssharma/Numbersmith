# Numbersmith

**A maths game that models how a child thinks, not just whether they were right.**

A working prototype of an AI-native maths game for roughly grades 2–3. It is not a
question bank with adaptive difficulty. It builds a running model of each child —
what they know, what wrong rules they are following, which representation they think
best in, how they behave after failing — and adapts the whole experience from it.

**[Live demo →](#)** *(add your GitHub Pages URL after the first deploy)*

---

## The one thing this prototype proves

> Give five children the same ten-minute opening. Does the system produce five
> meaningfully different learning journeys, for reasons you can point at?

Open the **Five children** tab. Five simulated learners are run through the same
engine the playable tab uses — nothing is scripted, the engine chooses every item and
the personas react. The screen shows how far apart the five experiences end up and,
for every item, why that item was chosen.

Measured across ten independent personalization dimensions, every pair of children
diverges on at least 3 and the average pair on 6.6. The full pairwise breakdown is
asserted in [`src/engine/__tests__/divergence.test.ts`](src/engine/__tests__/divergence.test.ts)
so it fails CI if it stops being true.

---

## What makes it AI-native rather than a game with a chatbot bolted on

Remove the intelligence layer and there is no product left — the item selection, the
diagnosis, the teaching response, the pacing, the tone, the world and the parent
report are all outputs of the learner model. What is *not* model-driven is the
diagnosis itself, deliberately; see [Safety](#safety-is-an-architecture-not-a-filter).

| Piece | What it does | Where |
|---|---|---|
| **Concept graph** | 14 concepts with prerequisites, so the system can ask "which prerequisite is actually missing?" rather than shuffling questions | [`conceptGraph.ts`](src/engine/conceptGraph.ts) |
| **Learner model** | Bayesian knowledge tracing per concept, plus behavioural traits — strategy, impulsivity, perseverance, frustration, confidence, stamina | [`learnerModel.ts`](src/engine/learnerModel.ts) |
| **Misconception engine** | 10 executable bug signatures. Recovers the *rule* behind a wrong answer instead of recording a zero | [`misconceptions.ts`](src/engine/misconceptions.ts) |
| **Intervention graph** | Repairs matched to the child's strongest surface; every attempt logged as `(bug, intervention, surface, outcome)` | [`interventions.ts`](src/engine/interventions.ts) |
| **Struggle controller** | PI controller with online bias correction, plus frustration and boredom overrides | [`struggle.ts`](src/engine/struggle.ts) |
| **Selector** | Decides what happens next and explains itself in one sentence, every time | [`selector.ts`](src/engine/selector.ts) |
| **Parent insights** | Plain-language findings and an off-screen activity. No accuracy percentage anywhere | [`parentInsights.ts`](src/engine/parentInsights.ts) |

### The north-star mechanic: the representation delta

The same concept is presented on three surfaces — **manipulative** (bundles you can
physically break open), **symbolic** (written numbers), **story** (a word problem).
Comparing performance *between* surfaces on the *same* concept is how the system
learns the difference between "cannot do subtraction" and "can do subtraction, cannot
read the question". That distinction is invisible to an accuracy score and it demands
completely different responses.

It is measured from the first minutes: the opening six items look like ordinary play
but deliberately interleave surfaces on the same concept. No quiz, no grade question,
no settings screen.

### The core mechanic: a number is a physical thing

Ten loose units snap into one bundle; a bundle breaks back apart. That single
affordance *is* place value, carrying and borrowing. A child who carries a ten has
physically bundled ten ones rather than remembered a mark above a column — and
"forgot to carry" stops being an inference, because it looks like twelve loose cubes
in a tray that holds nine.

Three worlds (a station, a grove, a detective's case file) reskin the same mechanic,
so children get visibly different games without tripling the content cost or making
their results incomparable.

### The metric, built as a mechanic

*"What share of children voluntarily attempt a harder problem after failing one?"* is
the most informative single number about a learner. So it is a game mechanic, not an
analytics event: after a miss, the child is offered two doors — one like the last one,
one harder. The choice is the measurement.

---

## Findings from building it

The interesting output of a prototype is what it disproves. Each of these was found by
running the engine, not by reasoning about it.

**1. An adaptive system that only serves what it believes is best can never learn it
was wrong.** The first version served each child their strongest surface, so it stopped
collecting the evidence that would have corrected it — and confidently told us the
child who freezes on word problems preferred word problems. Fixed with an explicit
exploration budget (~1 item in 4 early on) spent on the least-evidenced surface.

**2. Comparing raw accuracy across surfaces is a confound.** Because exploration serves
unfamiliar surfaces at lower difficulty, the surface a child is *worst* at can score
highest. The affinity estimate now compares residuals against predicted success, which
holds difficulty constant.

**3. An intervention that does not structurally prevent the bug is just more failure.**
Serving a child with a confirmed subtraction bug more subtraction dropped him to 23%
accuracy — the engine found his problem and then drilled him on it. A real intervention
removes the affordance the bug depends on: the unbundle ritual locks the ones tray, so
taking eight from two is not a move that exists.

**4. Signature matching has a false-positive rate.** Bugs whose predicted answer sits
next to the correct one are hit by ordinary near-misses often enough to produce
confident hallucinated diagnoses. Misconceptions now carry a `specificity` rating; the
low-specificity ones need a third sighting before the system acts.

**5. Turning the difficulty knob cannot fix a frontier problem.** The frontier concept
is by definition the one the child cannot yet do, so a session built from frontier items
runs at coin-flip accuracy however low the difficulty goes. The knob controls how hard an
item is, not how unfamiliar the idea is. The fix was to change *what* is served — step
back and consolidate something nearly known.

**6. The 80% target is not met, and the gap is structural.** Simulated children land at
43–63%. Roughly a third of every session is deliberately spent on diagnosis and
exploration rather than on winnable items, and traits like carelessness produce failures
no difficulty setting prevents. This is recorded as a test that catches the band
*shifting* rather than one that claims the target is hit. Closing it is the first thing
the next iteration should attack.

---

## Safety is an architecture, not a filter

The companion never holds an open-ended conversation with a child. The **engine**
decides the intent and content of every line — deterministic, auditable, testable. A
language model may only *rephrase* a chosen line inside a fixed intent, a length cap,
a banned-phrase list and a post-generation gate ([`companion.ts`](src/engine/companion.ts)),
falling back to the written line on any failure. "We could not have said something
harmful even if the model tried" is a far stronger promise to a parent than "we filter
it".

Likewise the parent view offers a fixed question list rather than a chat box, and no
model decides what is true about a child.

Two further product commitments, both enforced in code: timed pressure is opt-in by
behaviour and never switched on for a child showing frustration
([`struggle.ts`](src/engine/struggle.ts), asserted in the test suite); and the
companion evaluates the work, never the child.

> **Note on model providers.** Google's Gemini free tier states that content is used to
> improve their products. That makes it unsuitable for anything carrying children's
> data, regardless of cost. The prototype therefore runs fully offline by default and
> treats any model call as an optional enhancement to phrasing only.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 33 tests — engine behaviour and the divergence thesis
npm run build      # production build to dist/
```

No API keys. No backend. No account. The whole engine runs client-side and
deterministically, which is also why the demo is reproducible.

## Deploying

Push to `main` and the included GitHub Actions workflow builds and publishes to GitHub
Pages. Enable it once under **Settings → Pages → Source: GitHub Actions**.

The build honours a `VITE_BASE` environment variable, so the same repo deploys to
GitHub Pages (served from `/<repo>/`) and to Vercel or Netlify (served from `/`)
without changes.

## Layout

```
src/engine/     the intelligence layer — no React, no DOM, fully unit-testable
src/screens/    Play · Five children · The brain · Parent
src/components/ the bundle board manipulative
docs/           product plan, architecture, roadmap
```

The engine has no UI dependencies at all. That is deliberate: the intelligence is the
product, and it should be portable to a different renderer, a native app, or someone
else's classroom tool without a rewrite.

## Licence

MIT — see [LICENSE](LICENSE).
