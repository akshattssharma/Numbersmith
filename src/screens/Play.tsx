import { useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { BundleBoard } from '../components/BundleBoard';
import { companionLine, companionName } from '../engine/companion';
import { Session, type Turn } from '../engine/session';
import type { Diagnosis } from '../engine/types';
import { WORLDS } from '../engine/worlds';

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
 */

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
    started.current = Date.now();
    onTick();
  };

  const submit = () => {
    const res = session.submit(turn, entry, {
      latencyMs: Date.now() - started.current,
      hintsUsed: hints,
      churn,
    });
    setFeedback({ line: res.line.text, d: res.diagnosis, correct: res.attempt.correct });
    if (res.attempt.correct) {
      setStars((s) => s + 1);
      setStreak((s) => s + 1);
      setBurst(true);
      setTimeout(() => setBurst(false), 650);
    } else {
      setStreak(0);
    }
    if (turn.challengeDoorOffered && !res.attempt.correct) setDoorOpen(true);
    onTick();
  };

  const answered = feedback !== null;

  const stageStyle = {
    background: world.palette.bg, color: world.palette.ink,
    borderColor: 'rgba(255,255,255,0.09)',
  };

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

      <div className="stage kid" style={stageStyle}>
        {burst && <div className="starburst" aria-hidden>✨</div>}

        <div className="tiny" style={{ opacity: 0.55, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {world.name} · item {turn.index + 1}
        </div>

        <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
          {turn.rendered?.person && (
            <Avatar characterId={turn.rendered.person.characterId} size={46} name={turn.rendered.person.name} ring />
          )}
          <p className="prompt" style={{ marginTop: turn.rendered?.person ? 2 : 0 }}>
            {p.kind === 'catch' && p.plantedAnswer !== undefined
              ? `${prompt} ${companionName(world.id)} says the answer is ${p.plantedAnswer}.`
              : prompt}
          </p>
        </div>

        {p.representation === 'manipulative' ? (
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

        {turn.intervention && (
          <div className="small" style={{ marginTop: 16, opacity: 0.82, borderLeft: `2px solid ${world.palette.accent}`, paddingLeft: 12 }}>
            {turn.intervention.action}
          </div>
        )}

        <div className="companion">
          <div className="avatar">◕</div>
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
                {companionName(world.id)}, a clue?
              </button>
              {hints > 0 && (
                <span className="small" style={{ opacity: 0.8 }}>
                  {companionLine(session.model, 'hint').text}
                </span>
              )}
            </>
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
    </div>
  );
}
