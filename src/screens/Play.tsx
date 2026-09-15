import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { BundleBoard } from '../components/BundleBoard';
import { GatherBoard } from '../components/GatherBoard';
import { Lumie, type LumieMood } from '../components/Lumie';
import { classifyDragStrategy, type DropEvent } from '../engine/dragStrategy';
import { generateHint } from '../engine/hints';
import { Session, type Turn } from '../engine/session';
import type { Diagnosis } from '../engine/types';
import { WORLDS } from '../engine/worlds';
import type { WorldId } from '../engine/types';

/**
 * The child-facing surface. Everything the engine decides arrives here as
 * props; this file contains no pedagogy of its own, which is the point — the
 * intelligence is not in the renderer.
 *
 * Nothing on this screen is for an adult. No confidence meters, no policy
 * dump, no "why this item" panel — a child does not need to read a debug
 * console to enjoy a game, and showing them one does not make the game feel
 * smarter, it just makes it feel like homework with extra steps. That view
 * still exists — see The Brain, behind the parent gate.
 *
 * The background art (public/world-art/*) is cropped straight from the
 * child's own reference mockups — see the notes there for provenance. It sits
 * behind a dark scrim so the game itself stays legible over any art, at any
 * screen width, without the art ever needing a hard-coded safe zone.
 *
 * Shape, not just a beat: items are grouped into quests (a stated goal, a
 * meter that fills as the quest is played, a designed win at the end) and
 * quests are grouped into a sitting, which reaches its own ending instead of
 * running forever. The engine already decided all of this — session.quest
 * and session.sittingEnded — this file only ever renders what it finds there.
 */

const WORLD_ART: Record<WorldId, string> = {
  starship: 'starship.jpg',
  grove: 'grove.jpg',
  vault: 'vault.jpg',
};

const BASE = import.meta.env.BASE_URL;

export function Play({
  session, onTick, onExitToParent, childName,
}: {
  session: Session;
  onTick: () => void;
  onExitToParent: () => void;
  childName?: string;
}) {
  const [turn, setTurn] = useState<Turn>(() => session.nextTurn());
  const [entry, setEntry] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ line: string; d: Diagnosis; correct: boolean } | null>(null);
  const [hints, setHints] = useState(0);
  const [churn, setChurn] = useState(0);
  const [stars, setStars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [burst, setBurst] = useState(false);
  // Set once the child has explicitly settled on "that's enough for now" —
  // local to this mount on purpose. Reloading re-derives it from
  // session.sittingEnded (see App.tsx), so it never needs to be saved itself.
  const [resting, setResting] = useState(false);
  // Timestamped drops on the Gather board, this item only — reset every turn,
  // classified into a strategy signal only at submit time (see dragStrategy.ts).
  const [drops, setDrops] = useState<DropEvent[]>([]);
  const started = useRef(Date.now());

  const p = turn.selection.problem;
  const world = WORLDS[session.model.policy.world];
  // The engine already decided how much of the child's world this item can
  // carry. The screen renders that decision; it never makes it.
  const prompt = turn.rendered?.text ?? world.frame[p.kind](p);
  const [doorOpen, setDoorOpen] = useState(false);

  const reset = () => {
    const t = session.nextTurn();
    setTurn(t); setEntry(0); setFeedback(null); setHints(0); setChurn(0);
    // A door ignored in favour of "Next →" instead of a pick otherwise
    // leaks: it would reappear, stale, next time an item is answered.
    setDoorOpen(false);
    setDrops([]);
    started.current = Date.now();
    onTick();
  };

  const playMore = () => {
    session.beginSitting();
    setResting(false);
    reset();
  };

  const submit = () => {
    const res = session.submit(turn, entry, {
      latencyMs: Date.now() - started.current,
      hintsUsed: hints,
      churn,
      dragStrategy: classifyDragStrategy(drops),
    });
    setFeedback({ line: res.line.text, d: res.diagnosis, correct: res.attempt.correct });
    if (res.attempt.correct) {
      setStars((s) => s + 1);
      setStreak((s) => s + 1);
      setBurst(true);
      setTimeout(() => setBurst(false), 900);
    } else {
      setStreak(0);
    }
    if (turn.challengeDoorOffered && !res.attempt.correct) setDoorOpen(true);
    onTick();
  };

  const answered = feedback !== null;
  const mood: LumieMood = answered ? (feedback!.correct ? 'happy' : 'gentle') : hints > 0 ? 'thinking' : 'idle';
  const quest = session.quest;
  const questJustWon = turn.selection.reason === 'quest-win' && !answered;

  return (
    <div className="kidwrap">
      <div className="kidbar">
        <div className="kidbar-left">
          <span className="kidbar-name">{childName ? `Hi ${childName}!` : world.name}</span>
        </div>
        <div className="kidbar-stats">
          <span className="chip star" title="stars earned">⭐ {stars}</span>
          <span className={`chip flame ${streak >= 3 ? 'hot' : ''}`} title="answers in a row">🔥 {streak}</span>
        </div>
        <button className="grownups-link" onClick={onExitToParent}>Grown-ups →</button>
      </div>

      <div
        className="stage kid"
        style={{ backgroundImage: `url(${BASE}world-art/${WORLD_ART[world.id]})` }}
      >
        <div className="stage-scrim" style={{ background: `linear-gradient(180deg, ${world.palette.bg}55, ${world.palette.bg}ee 55%, ${world.palette.bg})` }} />

        {resting ? (
          <div className="stage-content resting" style={{ color: world.palette.ink }}>
            <Lumie mood="idle" size={72} />
            <p className="prompt" style={{ marginTop: 14 }}>See you next time! You earned {stars} star{stars === 1 ? '' : 's'} today.</p>
          </div>
        ) : (
          <div className="stage-content" style={{ color: world.palette.ink }}>
            {burst && <div className="starburst" aria-hidden>✨</div>}

            {quest && (
              <div className="queststrip">
                {/* The goal text added nothing next to the meter itself — the
                    dots already say "some done, more to go" at a glance. Kept
                    as an aria-label rather than dropped outright, since it's
                    still the right answer to "what is this progress bar for". */}
                <div className="questmeter" aria-hidden={false} aria-label={quest.goal.label}>
                  {Array.from({ length: quest.goal.itemsTarget }, (_, i) => (
                    <span key={i} className={i < quest.itemsDone ? 'on' : ''} />
                  ))}
                </div>
              </div>
            )}

            {questJustWon && <div className="winbadge">🌟 Last one for this quest!</div>}

            <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
              {turn.rendered?.person && (
                <Avatar characterId={turn.rendered.person.characterId} size={46} name={turn.rendered.person.name} ring />
              )}
              <p className="prompt" style={{ marginTop: turn.rendered?.person ? 2 : 0 }}>
                {p.kind === 'catch' && p.plantedAnswer !== undefined
                  ? `${prompt} They say the answer is ${p.plantedAnswer}.`
                  : prompt}
              </p>
            </div>

            <div className="playboard">
              {p.representation === 'manipulative' && p.kind === 'groups' ? (
                <GatherBoard
                  key={p.id}
                  world={world}
                  a={p.a}
                  b={p.b}
                  onChange={(n) => { setEntry(n); setChurn((c) => c + 1); }}
                  onDrop={(cellIndex) => setDrops((d) => [...d, { cellIndex, at: Date.now() }])}
                />
              ) : p.representation === 'manipulative' ? (
                <BundleBoard
                  world={world}
                  target={p.kind === 'load' ? p.answer : null}
                  value={entry}
                  onChange={(n) => { setEntry(n); setChurn((c) => c + 1); }}
                  lockOnes={turn.intervention?.id === 'unbundle-ritual'}
                  showBundleHint={turn.intervention?.id === 'overflow-tray' || session.model.policy.hintTiming === 'early'}
                />
              ) : (
                <div>
                  {p.representation === 'symbolic' && (
                    <div className="mono" style={{ fontSize: 34, marginBottom: 16, opacity: 0.9 }}>
                      {p.kind === 'combine' ? `${p.a} + ${p.b}`
                        : p.kind === 'ship' ? `${p.a} − ${p.b}`
                          : p.kind === 'groups' ? `${p.b} × ${p.a}`
                            : `${p.answer}`}
                    </div>
                  )}
                  <input
                    className="numpad"
                    inputMode="numeric"
                    value={entry || ''}
                    onChange={(e) => { setEntry(Number(e.target.value.replace(/\D/g, '')) || 0); setChurn((c) => c + 1); }}
                    placeholder="?"
                  />
                </div>
              )}
            </div>

            {turn.intervention && (
              <div className="small" style={{ marginTop: 16, opacity: 0.82, borderLeft: `2px solid ${world.palette.accent}`, paddingLeft: 12 }}>
                {turn.intervention.action}
              </div>
            )}

            <div className="companion">
              <Lumie mood={mood} size={64} />
              <div className={`bubble ${answered ? (feedback!.correct ? 'good' : 'gentle') : ''}`}>
                {answered ? feedback!.line : turn.line.text}
              </div>
            </div>

            <div className="controls">
              {!answered ? (
                <>
                  <button className="btn primary big" onClick={submit}>
                    {p.kind === 'catch' ? 'Fix it' : 'Done'}
                  </button>
                  <button className="btn ghost" onClick={() => setHints((h) => h + 1)}>
                    Lumie, a clue?
                  </button>
                  {hints > 0 && (
                    <span className="small" style={{ opacity: 0.8 }}>
                      {generateHint(p, world, hints >= 2 ? 2 : 1)}
                    </span>
                  )}
                </>
              ) : session.sittingEnded ? (
                <div className="sittingcard">
                  <b>Sitting complete! ⭐ {stars}</b>
                  <p className="small" style={{ opacity: 0.85 }}>
                    {session.questNumber} quest{session.questNumber === 1 ? '' : 's'} done today
                    {quest ? `, and you earned ${quest.goal.reward}.` : '.'}
                  </p>
                  <div className="controls">
                    <button className="btn primary big" onClick={() => setResting(true)}>All done for now ✓</button>
                    <button className="btn ghost" onClick={playMore}>Play a little more</button>
                  </div>
                </div>
              ) : quest && quest.concluded ? (
                <div className="questcard">
                  <b>Quest complete! You earned {quest.goal.reward}.</b>
                  <button className="btn primary big" onClick={reset}>Continue →</button>
                </div>
              ) : (
                <button className="btn primary big" onClick={reset}>Next →</button>
              )}
            </div>

            {doorOpen && answered && (
              <div className="doors">
                <button className="door" onClick={() => { session.answerChallengeDoor(false); setDoorOpen(false); reset(); }}>
                  <b>One more like that</b>
                  <span className="tiny" style={{ opacity: 0.7 }}>same size</span>
                </button>
                <button className="door" onClick={() => { session.answerChallengeDoor(true); setDoorOpen(false); reset(); }}>
                  <b>Something harder</b>
                  <span className="tiny" style={{ opacity: 0.7 }}>steeper</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
