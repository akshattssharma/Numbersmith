# Numbersmith — product and engineering plan

## 1. Thesis

> Every child is running a *method*. Today's maths games only ever see the answer, so
> they can tell a child is wrong but not what the child believes. Numbersmith models
> the method — the knowledge, the wrong rules, the representation they think in, and
> what they do after failing — and adapts the entire experience from it, not just the
> difficulty.

The test of whether this is AI-native: remove the intelligence layer and see what is
left. Here, nothing is — item selection, diagnosis, the teaching response, pacing,
tone, world and the parent report are all outputs of the learner model.

## 2. The wedge

**Grades 2–3. Number sense, place value, addition and subtraction with regrouping,
multiplication foundations.** Fourteen concepts.

Not K–5. The first version has to prove the intelligence loop, not cover a curriculum.
This band is chosen because it is where the classic, well-documented arithmetic bugs
live — smaller-from-larger, dropped carry, counting the starting number — which makes
it the band where a misconception engine can actually be demonstrated rather than
asserted.

## 3. The loop the MVP must prove

```
play → observe → diagnose → update the model → re-derive the policy
     → choose the next thing → teach if needed → re-test → repeat
```

If this works, content scales it. If it does not, content cannot save it.

## 4. Two users, one product

| | Child | Parent |
|---|---|---|
| Wants | fun, autonomy, achievement, identity | confidence, visibility, proof, safety, low effort |
| Gets | a world where maths unlocks progress | three plain-language findings and one off-screen activity |
| Never sees | any of the machinery | an accuracy percentage |

## 5. What is built (this repo)

- **Concept graph**, 14 nodes with prerequisites → answers "which prerequisite is
  actually missing?"
- **Learner model** — BKT per concept, plus behavioural traits (strategy inferred from
  latency-vs-magnitude, impulsivity, perseverance, hint reliance, frustration,
  confidence, stamina)
- **Misconception engine** — 10 executable bug signatures with specificity ratings
- **Intervention graph** — 15 interventions across 3 surfaces, every delivery logged
- **Productive-struggle controller** — PI control with online bias correction,
  frustration and boredom overrides
- **Selector** — 9 selection strategies, each self-explaining
- **Three worlds** reskinning one bundle/unbundle mechanic
- **Companion** — bounded template bank with a gated optional model rephrase
- **Parent product** — insight generator and a fixed question set
- **Five-children simulator** — the thesis, executable and asserted in CI

## 6. Deliberately not built yet

Accounts and persistence · real art and audio · multiplayer · content-authoring tools ·
a server · a payment path · fractions, geometry, measurement · native apps.

Every one of these is real work, and none of it changes whether the intelligence loop
holds. Building any of them first would have hidden the six findings in the README.

## 7. Metrics

Not DAU. Three families:

**Learning** — concept mastery; retention across sessions; misconception resolution
rate; transfer (does the repair hold on a *different* item type?).

**Engagement** — voluntary return; session completion; child-initiated play; recovery
after a difficult moment.

**Confidence** — *the headline*: share of children who voluntarily attempt a harder
problem after failing one. Instrumented as a game mechanic (the two-door choice), not
as an analytics event.

The instrumentation exists in the prototype: `challengeDoor: { offered, tookHarder }`.

## 8. The moat

Not the art, the question bank, or the model. It is the accumulating table of
`(misconception, intervention, surface, condition, outcome)`.

At one child it is a debugging aid. At scale it answers a question no question bank
can: not "is this child stuck" but "what has actually worked for children stuck in
this specific way, on this specific surface". It is logged from the first prototype
session precisely because it is worthless if you start logging it once you have scale.

## 9. Roadmap

**Now — prototype (done).** The loop, the divergence proof, the parent view, the
findings.

**Next 4–6 weeks — validate with real children.** 15–20 children, 3 sessions each. The
questions: do the misconception signatures fire on real answers at an acceptable
false-positive rate; do the interventions actually shift the bug; does the
representation delta match what a teacher independently says about that child. This is
the step that decides whether the thesis survives, and simulated children cannot
answer it.

**Then — close the 80% gap.** The structural finding (#6 in the README) is the
clearest engineering target: rebalance the session mix so diagnosis and exploration
cost less accuracy, and give the controller authority over concept choice, not just
item difficulty.

**Then — persistence and the parent loop.** Accounts, cross-session retention, spaced
review across days, the weekly parent email. Retention is the first real business
question and cannot be tested in a single-session prototype.

**Then — the content engine.** Tools so an educator adds a world, a bug signature and
its interventions without an engineer. The economic claim behind the whole product is
100 experiences without 100 content creators, and that claim is untested until someone
outside the team ships one.

**Later — the second subject.** Maths is the wedge; the learner model is the company.

## 10. Risks, honestly

**The misconception library is hand-built and small.** Ten bugs covers the classic
arithmetic errors well and nothing else. Growing it is manual expert work, and mining
it automatically from response data is a research project, not a sprint.

**Simulated children are a regression test, not evidence.** They prove the engine
differentiates learners whose differences we designed in. They say nothing about
whether real children learn more. Treating them as validation would be the most
tempting mistake available here.

**The 80% target is not met** (README finding 6), and the gap is structural rather
than a tuning issue.

**Signature matching has a false-positive rate** that specificity ratings reduce but
do not eliminate. A wrong diagnosis sends a child into a repair loop for a bug they
never had — the most expensive failure this system can produce, and the thing real-child
testing should measure first.

**Safety is architectural but not audited.** The bounded-companion design is the right
shape; it has not been through a formal review, and no COPPA/FERPA work has been done.

## 11. Tool stack

Everything below is free at prototype scale. Costs and limits verified September 2026.

| Need | Choice | Free-tier reality |
|---|---|---|
| App | Vite + React + TypeScript | free, MIT |
| Tests | Vitest | free |
| Hosting | **GitHub Pages** | free for public repos, no cold start, no card |
| CI | GitHub Actions | 2,000 min/month free; this build uses ~2 min |
| Repo | GitHub | free, public |
| Optional model | Groq or Gemini | see the note below |

**On model providers for a children's product.** Google's Gemini free tier states that
content is used to improve their products — which rules it out for anything carrying
children's data at any price. Groq's free tier is rate-limited (roughly 30 requests/min,
1,000/day on the open models) and fine for a demo. The prototype runs fully offline and
treats a model call as an optional enhancement to *phrasing only*, which is why neither
constraint blocks it.

**On the no-code builders.** Lovable's free plan grants 5 build credits/day (max 30/month)
and roughly one prompt costs 0.5–1.7 credits; custom domains are Pro ($25/mo). That is
enough to iterate on a UI, not enough to build an engine of this size. Make.com's free
plan is 1,000 credits/month, 2 active scenarios and a 15-minute minimum interval — it is
an automation tool, not an app runtime, so it fits a future parent-email workflow rather
than this. The pragmatic split: hand-write the engine (which is the defensible part and
which credits would be wasted on), and use Lovable for visual iteration on the screens
if you want it — its native stack is Vite + React + TypeScript, which is exactly what
this repo is.
