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
| **Selector** | Decides what happens next and explains itself in one sentence, every time — including a duty-cycled override so no single interaction kind runs unbroken for long | [`selector.ts`](src/engine/selector.ts) |
| **Hints** | Generated from the actual problem on screen — its operands, its regrouping state — and made more specific on a second ask, never the same fixed sentence twice | [`hints.ts`](src/engine/hints.ts) |
| **Quest layer** | Wraps the item stream in a stated goal, a meter that fills on effort, and a designed win — so a sitting has a beginning, a middle and an end instead of running forever | [`quest.ts`](src/engine/quest.ts) |
| **Gather** | A real drag gesture for equal-groups problems, not a typed number — and the way it's played (filled at once vs. one at a time) is a diagnostic signal a typed answer cannot produce | [`GatherBoard.tsx`](src/components/GatherBoard.tsx), [`dragStrategy.ts`](src/engine/dragStrategy.ts) |
| **Companion** | Lumie, an inline SVG with independently animated eyes (they track the pointer), a blink, and a mouth shape per mood — not a PNG swapped between a handful of static poses | [`Lumie.tsx`](src/components/Lumie.tsx) |
| **Speech** | The prompt and every hint read aloud on-device (no recording, no network) — the only workable choice once content is procedurally generated rather than fixed. Tone shifts with the moment (calm for a prompt, warmer and quicker for a correct answer, softer for a miss); sound is a persisted per-child toggle. Deliberately says nothing before the child has answered — see finding 17 | [`speech.ts`](src/engine/speech.ts) |
| **Installable / offline** | A manifest and a precaching service worker (`vite-plugin-pwa`) — installs to a home screen or dock with its own icon, and keeps working with no connection once it's been opened once | [`vite.config.ts`](vite.config.ts), [`public/icons/`](public/icons) |
| **Reward tiers** | Three things that already existed in the model — a correct answer, a concluded quest, a concept crossing mastery — made visible: a lifetime star count, a per-world collection, and a kid-safe constellation of what's been learned. Every tier flies from where the child answered to where it lives, so the counters never feel disconnected from the play that earned them | [`session.ts`](src/engine/session.ts), [`Constellation.tsx`](src/components/Constellation.tsx), [`WorldCollection.tsx`](src/components/WorldCollection.tsx), [`RewardFlight.tsx`](src/components/RewardFlight.tsx), [`ProgressOverlay.tsx`](src/components/ProgressOverlay.tsx) |
| **Parent insights** | Plain-language findings and an off-screen activity. No accuracy percentage anywhere | [`parentInsights.ts`](src/engine/parentInsights.ts) |
| **Personalization** | The child's friends and favourite things woven into problems — gated by the learner model, with a control holdout to check it works | [`cast.ts`](src/engine/cast.ts), [`storyTemplates.ts`](src/engine/storyTemplates.ts) |
| **Household** | Kid mode vs. parent mode, a local PIN gate, and more than one child on the same device — each with their own progress, cast and favourites | [`household.ts`](src/engine/household.ts) |
| **Durability** | A parent-initiated JSON backup of the whole household — no account, nothing sent anywhere — restorable from either the Kids tab or, since a fresh device has no children yet to reach that tab, the onboarding screen itself. See finding 19 | [`household.ts`](src/engine/household.ts), [`RestoreBackup.tsx`](src/components/RestoreBackup.tsx) |
| **Mastery loop** | Once every one of the 14 concepts is mastered, the selector stops pretending there's still a frontier to push into and switches to honestly-labeled review, rotating by staleness; the parent view, constellation and Brain view all read the same `graphMastered()` rather than each guessing. See finding 20 | [`learnerModel.ts`](src/engine/learnerModel.ts), [`selector.ts`](src/engine/selector.ts) |
| **Landing** | A one-screen introduction shown once, before onboarding, only while a device has zero children — pure copy and a single "Get started" decision, no engine import. See finding 21 | [`Landing.tsx`](src/screens/Landing.tsx) |
| **Signing out** | No accounts means "sign out" has to mean something else: erase every child's own save and the PIN, so a different family can set up their own household on the same browser. Pushes a backup first. See finding 22 | [`household.ts`](src/engine/household.ts), [`KidsManager.tsx`](src/screens/KidsManager.tsx) |

### Two screens, not one with a debug panel bolted on

A child's screen shows the game and how they did — nothing else. A parent's shows the
model that decided what to serve, why the last item was chosen, every child's progress,
and the tools to add a child or change the cast. These used to be one screen with an
inspector panel next to the play area; see [finding 10](#findings-from-building-it) for
why that was wrong and what replaced it.

- **Kid mode** — the whole surface is the game: the world, the companion, a star count
  and a streak. A small "Grown-ups →" link is the only way out, and it leads to a PIN
  pad, not straight into settings.
- **Parent mode** — who's playing (add a child, switch, remove), their cast and
  favourites, the parent insights, and the engine made inspectable. Getting back to the
  game is one tap, no PIN required in that direction.
- **The PIN** is a local 4-digit code, set on first run, checked entirely on this
  device — there is no server to check it against, so it is a speed bump for a curious
  seven-year-old, not authentication for a bank. A forgotten PIN resets via a quick
  adult-arithmetic check rather than an email link that has nowhere to go.

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

### Personalization, with the brakes fitted

Problems are told in the child's own world: their friend Jack, their favourite
footballs, the park. Friends appear as characters from a curated library of 60 —
named by the child, never generated from a photo. First names only, parent-entered,
stored on-device, and stripped from anything that could reach a model.

Three constraints do most of the work here, and each one exists because the obvious
version is wrong:

- **The learner model decides the intensity, not a settings toggle.** A child whose
  story-surface performance trails their symbolic performance is telling us the
  *sentence* is the hard part. Giving them a longer, warmer sentence is a kindness
  that costs them accuracy. For that child, personalization switches off.
- **A name must never become the maths.** "Jack brings 3 more" leaves open whether he
  handed them over. Every template states the direction of transfer explicitly, and
  the child is always the single pile being counted.
- **One story item in six stays deliberately generic.** Same sentence structure, "your
  friend" instead of Jack, "blocks" instead of footballs — one variable isolated — so
  the claim that personalization helps can actually be checked, per child.

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

**6. Personalization has to be able to switch itself off.** Vivid detail competes for
the same working memory the arithmetic needs, and it costs most for the child already
struggling with language. Intensity is therefore derived from the story-surface signal
and the frustration level. The first thresholds were also wrong in the opposite
direction — they required a *positive* story signal before naming anyone, so nearly
every child sat at the lowest setting and the feature never appeared. The right prior
is: help most children, back off on evidence about this one.

**7. A control arm has to differ in exactly one variable.** The first holdout rendered
control items as bare notation, so it compared surface *and* personalization at once
and could not have answered its own question. Controls now keep the sentence structure
and swap only whose world it is about. Relatedly, personalization is kept off the
calibration probe entirely — you do not personalize the instrument you are measuring
with.

**8. The per-child A/B is underpowered and says so.** One session yields about five
control items against an effect smaller than the item-to-item noise. The lift figure
reports `adequate: false` rather than a tempting number. The reads that will work are
pooled across children (days) or per child across sessions (weeks) — both of which
need the logging running from session one.

**9. The 80% target is not met, and the gap is structural.** Simulated children land at
43–63%. Roughly a third of every session is deliberately spent on diagnosis and
exploration rather than on winnable items, and traits like carelessness produce failures
no difficulty setting prevents. This is recorded as a test that catches the band
*shifting* rather than one that claims the target is hit. Closing it is the first thing
the next iteration should attack.

**10. Inspectability for the builder is not the same feature as inspectability for the
child.** The first version put the learner model — confidence, frustration, the current
policy, a "why this item" panel — directly next to the play area, on the theory that
transparency is always good. It isn't, for this audience: a seven-year-old does not
benefit from a debug console, and it dilutes a screen that should be entirely about the
game. The fix wasn't to remove the model view, it was to move it — it now lives in The
Brain, behind the same parent gate as the cast editor and the child roster, and the
child's screen shows only the game, a star count and a streak.

**11. A debug-console layout and a "boring" layout are not the only two
options.** Early feedback on the child screen wasn't "add more explanation" —
it was the opposite: too many words, not enough reason to be curious about
what happens next. The fix wasn't a redesign of the mechanic, it was
presentation: illustrated backdrops per world, a single animated companion
(Lumie) whose mood is conveyed through motion rather than swapped art, item
progress as dots instead of a text counter, and every remaining line of
companion/UI copy cut to the shortest thing that still tells the child what to
do. The pedagogy underneath — and everything in The Brain — is unchanged.

**12. A complete tutoring loop is not a game, and the gap doesn't show up in
tests.** `observe → diagnose → adapt → serve the next item` is a loop with no
exit and no shape: "what's the optimal next item" always has an answer, so it
served items until a child had answered 65 of them with nothing that ever
resolved — the engine already computed a personalized `sessionTarget` and
exposed `shouldEnd()`, and the screen never called it. Every existing test
passed the whole time, because none of them asked whether the *experience*
had a beginning, a middle, and an end. The fix adds two wrapper layers
(`quest.ts`, and quest/sitting bookkeeping in `session.ts`) without touching
the pedagogy underneath: items are grouped into a quest with a stated goal
and a meter that fills on items completed — never on correctness, so a
struggling child still finishes their quest — and a quest's last item is
reserved as a designed win, pitched at roughly 88% predicted success on the
child's strongest concept rather than left to chance. A sitting holds one to
three quests and ends the moment one concludes if the child's own stamina
estimate (or the frustration safety valve) says it should, closing on a
resolved goal rather than mid-item. The honest cost, paid deliberately: a
quest's last item is chosen to land, not to teach or diagnose, so roughly one
item in six to nine carries less diagnostic weight than an ordinary one —
traded for an ending that actually arrives. A second bug fell out of fixing
the first: calibration was gated on the *session's* item count, which is
harmless for a session that never resets, but would have replayed the same
six diagnostic items at the start of every sitting once sittings became a
real boundary — fixed by gating it on lifetime history instead, which also
means the existing "welcome back" companion lines (written for a returning
child, previously unreachable because nothing ever reset) now actually fire.

**13. A typed number cannot see *how* a child got there, and that gap doesn't
close by adding more feedback — it closes by changing the input.** Every kind
of problem reduced to the same verb: adjust a number until it matches,
whether the underlying operation was composing, merging, removing or
grouping. Equal-groups problems are where that costs the most, because the
concept itself — three groups of five is not the same idea as fifteen —
depends on grouping being something the child can actually *do*, not just
read about in a sentence. The fix (`GatherBoard.tsx`, real drag physics via
Framer Motion) replaces the typed number for this one kind with a drag: units
dropped into group cells, no cap enforced on how many land in one, because
overfilling a group *is* the interesting mistake, not a glitch to prevent.
The more important find was that this unlocks a signal no typed surface can
produce at all: the *timing* between drops distinguishes a child who fills a
group in one fast, confident motion (already knows it holds this many) from
one who places every item a deliberate beat apart (still counting to be
sure). That distinction was completely invisible before — a correct "15" from
either child looked identical. It's now a real field on the attempt
(`Attempt.dragStrategy`), read only by the parent view as a plain-language
finding, not folded into the existing latency-based strategy trait — mixing
an unproven new signal into a controller that took ten other fixes to get
right was a risk worth declining. Deliberately scoped to one verb, done
properly, rather than three done as a shallow reskin of the same tap
interaction: `load`/`combine`/`ship` still use the bundle board, which is
already a real physical model (tens and ones you build and break open), not
a placeholder waiting for the same treatment on principle.

**14. Real play surfaces bugs a fixed test suite doesn't ask about, because it
doesn't know to.** A short real playthrough turned up a genuine defect
(`session.ts`'s pre-answer line was computed twice, and the second, actually-used
version had a dead branch: its final fallback said `'greet'` where it meant
`'correct'`, so every item after the first in a sitting greeted the child
again instead of reacting to what they'd just done) that 94 passing tests had
not caught, because nothing was asserting on companion *beat* metadata, only
on the pedagogy. Same playthrough found that concept-to-kind is a fixed 1:1
mapping (`place-value-2digit` is always "build the pile"), which is fine in
isolation but means an ordinary, correctly-progressing child could hit the
same interaction 25-39 items in a row whenever the selector's own good
reasons (shore a shared prerequisite, consolidate near-mastered material)
kept landing on the same concept — and, more surprising, that a child who
masters the entire 14-concept graph (which a consistently-succeeding learner
does in roughly 50-60 items) hit an unrelated bug: `pickFrontier`'s fallback
defaulted to `order[0]` regardless of whether that concept was itself
mastered, so a "graduated" child got hammered with one fixed concept forever
with no honest reason to. Fixed with a duty-cycled kind-variety override
(same shape as the existing repair duty-cycle) plus a staleness-based
rotation once nothing is left to teach — both additive, neither touches
tiers with a genuine pedagogical reason to hold their ground (repair,
disambiguate, shore-prerequisite are never overridden). Also: a hint that
says the same fixed sentence regardless of the problem on screen isn't a
hint, it only reads like one until a child asks twice — replaced with
`engine/hints.ts`, generated from the actual operands and regrouping state
of the item in front of the child, and made progressively more concrete on
a second ask without ever stating the final answer outright.

**15. The engine already produced every signal a reward system needs — the
gap was that none of it ever reached the screen.** A correct answer, a
concluded quest, a concept crossing its mastery threshold: all three already
existed as facts inside the learner model, computed and then discarded every
turn. Nothing new had to be invented to make progress visible; `session.ts`
just had to notice the three transitions it was already producing (comparing
mastery before/after an attempt, and the quest's `concluded` flag before/after
`advanceQuest`) and hand them out on `TurnResult` — `starsEarned`,
`collectionGained`, `newlyMastered`. The two real bugs were both in Framer
Motion, not the pedagogy. First: animating an SVG geometry attribute directly
(`animate={{ r: [15, 19, 15] }}` on a `<circle>`) throws a console error on
every frame, because Framer Motion's declarative array syntax is written for
transforms, not raw attributes — the fix animates `scale` instead, with an
explicit `transformOrigin` set to the circle's own centre (SVG's default
origin is the viewport corner, so without it the node swells from the wrong
point). Second, a design bug, not a code one: the companion's "thinking" and
"gentle" moods were both a downward-curving mouth, and read as the same
sympathetic frown until it was compared side by side against the four other
moods — curiosity and sympathy need visibly different shapes, so "thinking"
became a small "o" instead. Both were caught by looking, not by a type
checker or a passing test, which is the same lesson finding 14 already drew
about companion beats: a fixed suite only asks the questions it was written
to ask.

**16. Voice acting was never actually on the table, and not because of
production budget.** The prompt and the companion line are both
procedurally generated — a prompt's numbers change every item, and
`companion.ts` alone has 15 lines x 4 tones per beat, deliberately built
that way so nothing repeats. There is no fixed script a voice actor could
ever read, in the same way there's no fixed set of personalized sentences
to record. That makes on-device text-to-speech
(`window.speechSynthesis`) the only architecturally sound choice, and a
convenient one: no recording, no network call, no asset pipeline, which
keeps the "nothing leaves the device" commitment intact exactly the way
the optional LLM rephrase already does for text. The one thing genuinely
absent — a celebratory sound for a correct answer — didn't need a sourced
audio clip either: three sine-wave oscillators playing an ascending triad
(`speech.ts`) is a full chime with no asset at all. The one bug this
surfaced was pure React, not audio: `Play.tsx`'s per-turn speech effect
fired twice on the very first item in dev mode, which looked exactly like
a real double-speak bug until the same run against the production build
(`vite build && vite preview`) showed it happening exactly once — a
Strict Mode double-invoke, the same "mount, clean up, mount again" check
React deliberately runs only in development, not a defect in the effect
itself.

**17. Reading text aloud doesn't just narrate a bug, it amplifies it.**
`session.ts` computed a "pre-answer companion line" for every item after
the first — but its beat always resolved to `'correct'`, so Lumie's line
before an answer was drawn from the exact same bank as feedback *after*
one. On screen this read as mildly repetitive and easy to skim past: a
child playing normally would see "Alright, that one counted." sitting
next to an unanswered problem and not think much of it. Said out loud,
the same line stopped being skimmable — a voice audibly congratulating a
child on a problem they hadn't touched yet is confusing in a way idle
text never was, and it surfaced immediately from a real playthrough, not
a test. The fix wasn't a better beat for the pre-answer moment; there
isn't one, because there's nothing genuine for Lumie to say about an
item nobody has attempted. `Turn.line` was removed from the engine
entirely rather than patched, and the companion bubble now renders
nothing at all until the child answers, resetting to nothing the moment
the next item loads. Same lesson as finding 14, from the opposite
direction: a fixed test suite didn't catch this because nothing was
asserting on it, and this time neither did silently reading the screen —
it took someone actually listening.

**18. A "designed win" that scales with belief isn't designed, and isn't a
win.** Finding 9 recorded the 80% target as structurally out of reach and
moved on — but the two mechanics built specifically to *guarantee* a
success (`quest-win`, the last item of every quest, and `confidence-win`,
fired by the struggle controller for a child who needs one) were never
checked against how a simulated child actually answers, only against the
engine's own belief about them. `questWinDifficulty()` picked a difficulty
by solving `expectedSuccess(pKnow, difficulty) = 0.88` for whatever `pKnow`
the engine currently believed — so as belief in mastery rose, the item got
*harder*, exactly backwards, because `expectedSuccess()` is the engine's
model of the child, not the child. Running the five-children simulation
and comparing the engine's predicted success against each persona's own
(BKT-independent) response formula for their actual quest-win items showed
the gap directly: real accuracy on quest-win items was 19% against an
intended ~88%. The fix drops the belief-scaling entirely — quest-win now
always asks at a flat, low difficulty (0.10), the same shape confidence-win
already used at 0.05, both now justified by having swept candidate flat
values against every persona's real response formula rather than picked by
feel. That surfaced a second, older bug shared by both mechanics:
`strongestConcept()`, which picks *which* concept gets the guaranteed-easy
item, ranked by raw mastery alone — capable of crowning a concept attempted
once and gotten lucky on (BKT's `guess` parameter can inflate `pKnow` fast
on thin evidence), or worse, a concept drilled hard because of a live
misconception, whose capped-but-still-highest score could still top the
ranking. Sam — the persona with a confirmed subtraction bug — was the
clearest case: her designed wins kept landing on the buggy concept itself.
`strongestConcept()` now requires at least 5 attempts before a concept is
eligible, excludes any concept touched by an unresolved misconception
(suspected, confirmed, or still resolving — not just confirmed, since the
skew showed up before confidence reached that bar), and falls back to an
absolute mastery floor of 0.6 when enough seasoned concepts exist to
choose one. Pooled quest-win accuracy went from 19% to 52% (Maya 17%→80%,
Alex 40%→75%, Riley 0%→40%, Nia 33%→50%); Sam's held near 0% on a small
sample, which is the mechanic correctly refusing to hand her a win on a
concept she hasn't actually earned yet, not a residual bug. That refusal
shows up in the divergence test too: Sam's overall session accuracy sits
right at 30%, the band's new floor — one persona legitimately paying for
not getting a rigged win the other four still get. This is the same
lesson as finding 9 from a sharper angle: a percentage nobody checked
against real behavior isn't evidence of anything, guaranteed or not.

**19. A restore feature that only lives where you already have progress
can't do the one thing it exists for.** Durability here means one thing
honestly: everything lives only in this browser's `localStorage`, so the
only backup a family gets is one they take themselves — a parent-initiated
JSON file, no account, nothing sent anywhere, restorable on another device.
The first version built the whole thing as a card in the Kids tab of the
parent view: download a backup, restore one, done. It worked, and it also
missed the actual scenario the feature exists for. `App.tsx` shows
`Onboarding` unconditionally whenever `household.children.length === 0` —
which is exactly the state of a brand-new device or a browser profile
that just got cleared, and there is no path from that screen into the
parent view at all, because there's no child yet to build a `Session`
around. A parent arriving at a fresh install with their old backup file
in hand would have hit "Welcome — who's playing?" with nowhere to put it.
The fix pulled the restore half of the feature (file picker, parse,
confirm-and-overwrite) out into its own component, `RestoreBackup.tsx`,
so it could be mounted twice: once in the Kids tab for a parent tidying
up an existing device, and once on `Onboarding`'s first screen for
exactly the "new device" case, with the overwrite warning simply omitted
when there's nothing yet to overwrite. Restoring a household also has to
drop `App.tsx`'s cached `Session` object, not just update state — the
existing autosave tick (`persistActive()`) would otherwise write the
stale in-memory save straight back over the file a parent just restored,
silently undoing it. Caught before shipping, by actually running the
scenario end to end (fresh device, download, wipe storage, restore) in a
real browser rather than by unit-testing the pieces in isolation — the
same category of gap as finding 15's Framer Motion bugs, a fixed suite
only answers the questions it's asked, and "does this feature reach the
person who needs it" isn't a question a component test knows to ask.

**20. Finishing the curriculum was already possible; the engine just lied
about it.** Nothing stopped a child from mastering all 14 concepts —
`pickFrontier()` already had a staleness-rotation fallback for exactly that
case (added when finding it silently defaulted to the same concept
forever). What it didn't have was honesty about what was happening next:
once every concept crossed 0.85, the selector kept reporting `'frontier'`
and rationale text like "Prerequisites are in place... pushing forward at
difficulty 0.50" for a concept that had nothing left to push into — the
same shape of bug finding 17 fixed for the companion line, just aimed at
the Brain view instead of a child's ear. There was also no acknowledgment
anywhere else: the parent view kept naming a "frontier" concept as if
something new were still being taught, and the constellation, kid- or
parent-facing, gave a fully-lit sky no different treatment than a sky with
one star left dim. Asked to design an endgame, the honest scope turned out
to be smaller than "endgame" suggests: the review mechanism already
existed and didn't need reinventing, it needed to stop pretending to be
something else. `graphMastered()` (`learnerModel.ts`) is now the one place
that question gets answered, and `selectNext()`'s new `'mastery-review'`
tier, `parentInsights.ts`, `Constellation.tsx` and `TurnResult.graphCompleted`
all read it rather than each quietly re-deriving their own guess. New
curriculum content (fractions, geometry) stays out of scope on purpose —
"mastery loop now, content later" was the explicit brief, and the two are
separable: the loop that keeps a graduated child engaged doesn't need new
material to justify existing, and building it revealed that the two
follow-on fixes (an honest reason label, and telling the parent and child
what actually happened) mattered more than any new mechanic would have.

**21. A live app with zero introduction is a form, not a product.**
Pasting the deployed URL dropped a first-time visitor straight onto
"Welcome — who's playing?" — a name field, a character grid, and a PIN
setup, with nothing above it explaining what the child's name was even
for. That screen is correct as the second thing a parent sees; it is a
bad first thing, because it assumes the decision to try the product has
already been made. `Landing.tsx` is now that first thing: a short,
honest description of what Numbersmith actually does (diagnoses the
specific wrong rule behind a mistake, adapts the whole experience rather
than a difficulty number, keeps everything on-device), and exactly one
button. It is deliberately thin — no engine import, no state beyond "has
this been dismissed this session" — because there is no pedagogy to a
marketing screen; the decision it makes is binary, not diagnostic. The
one thing it does *not* do is duplicate `Onboarding`'s restore-from-backup
control: a returning parent on a new device still clicks through to
`Onboarding` first, which already owns that path (finding 19). Shown once
per session, gated on `household.children.length === 0` the same way
`Onboarding` already was — so a household that empties its roster later
skips straight back to `Onboarding` rather than re-explaining the product
to someone who just used it.

**22. "No accounts" cuts both ways — it also means there's no login to
sign out of.** A device with one family's children set up on it had no
way to hand the browser to a second family: every screen assumed
whoever was looking at it belonged to the one household already stored.
The honest fix isn't a login system — that would be the exact backend
this app has refused to add through 21 prior findings — it's naming what
"sign out" actually means here: erase this family's children and PIN
from this browser, on purpose, so the next person gets a genuinely clean
slate. `resetHousehold()` deletes every child's own save individually
(not just the household record that lists them, the same distinction
finding 19's restore logic already had to get right) and clears the PIN
alongside them, since a new family shouldn't inherit the old one's lock.
The Sign out card in the Kids tab pushes a backup first — reusing the
same `downloadBackup()` the Backup card already has — before a second,
separate confirm actually calls it, matching the weight of the action:
this is the only control in the app that can discard more than one
child's progress in a single click. `App.tsx`'s `signOut()` is kept
distinct from the existing `restoreHousehold()` for one reason: it also
flips `Landing`'s dismissed flag back to `true`, because unlike an
ordinary empty roster (one child removed by mistake), a sign-out means
the very next visitor to this browser may not be this family at all, and
deserves the same introduction a first-time visitor gets.

**23. A button that works and a button that looks broken can be the same
button.** "Read the trace" on the Five Children screen was reported as
doing nothing — clicking it produced no visible change at all. It
wasn't broken: `onOpen` fired, state updated, and a full item-by-item
trace plus the matching parent insights rendered exactly as designed.
It rendered roughly 1,800 pixels below the button, though, past two
other full-height sections ("Where the five journeys separate" and the
personalization-lift table), with nothing to carry a viewer's eye that
far — so from behind the button, the outcome was indistinguishable from
nothing happening. The fix is two changes, not one: the detail panel
now mounts immediately after the row of child cards instead of after
everything else on the page, and a small wrapper re-fires
`scrollIntoView({ behavior: 'smooth' })` on the persona id whenever a
trace opens, so clicking a *different* child's button while one is
already open still scrolls, not just the first click. Caught the same
way findings 15 and 21 were — by actually clicking it in a real browser
rather than trusting that "the state updates correctly" means "the
feature works." A feature only a test suite has used is not yet a
feature anyone else has used.

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

The personalization feature is built to the same standard. Friends are characters from
a curated set, never likenesses generated from a photo — the highest-risk thing a
children's product can do, and one that buys less than it appears to, since what makes
it *their* Jack is the name and the role. Names are first-name-only, parent-entered,
never leave the device, and are scrubbed as part of *constructing* the model payload
rather than as a later step, so there is no path by which a caller can forget.

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
npm test           # 123 tests — engine behaviour, the divergence thesis, personalization safety, the quest/sitting shape, the gather signal, companion variety, dynamic hints, kind variety, the reward tiers and their persistence, speech
npm run build      # production build to dist/
npm run preview    # serves dist/ — the service worker only registers against a real build, not `npm run dev`
```

No API keys. No backend. No account. The whole engine runs client-side and
deterministically, which is also why the demo is reproducible.

It's installable: open it in a browser and use "Add to Home Screen" / the
install icon in the address bar, and it keeps working with no connection
after that first visit — the manifest and the precaching service worker
live entirely in [`vite.config.ts`](vite.config.ts) (`vite-plugin-pwa`), so
there's no separate app to build or ship. Test the offline behaviour against
`npm run preview`, never `npm run dev` — Vite's dev server doesn't run a
service worker, so "does it work offline" can only ever be answered against
the real build.

## Deploying

Push to `main` and the included GitHub Actions workflow builds and publishes to GitHub
Pages. Enable it once under **Settings → Pages → Source: GitHub Actions**.

On Windows with no terminal at all, see [docs/WINDOWS-SETUP.md](docs/WINDOWS-SETUP.md) —
GitHub builds the site, so Node never has to be installed locally.

The build honours a `VITE_BASE` environment variable, so the same repo deploys to
GitHub Pages (served from `/<repo>/`) and to Vercel or Netlify (served from `/`)
without changes.

## Layout

```
src/engine/     the intelligence layer — no React, no DOM, fully unit-testable
src/screens/    Play · Five children · The brain · Parent · Their world (setup)
src/components/ the bundle board manipulative, the character avatars
docs/           product plan, architecture, roadmap
```

The engine has no UI dependencies at all. That is deliberate: the intelligence is the
product, and it should be portable to a different renderer, a native app, or someone
else's classroom tool without a rewrite.

## Licence

MIT — see [LICENSE](LICENSE).
