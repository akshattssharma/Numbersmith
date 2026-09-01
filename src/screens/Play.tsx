import { useMemo, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { BundleBoard } from '../components/BundleBoard';
import { companionLine, companionName } from '../engine/companion';
import { MISCONCEPTIONS } from '../engine/misconceptions';
import { Session, type Turn } from '../engine/session';
import type { Diagnosis } from '../engine/types';
import { WORLDS } from '../engine/worlds';

/**
 * The child-facing surface. Everything the engine decides arrives here as
 * props; this file contains no pedagogy of its own, which is the point — the
 * intelligence is not in the renderer.
 */

export function Play({ session, onTick }: { session: Session; onTick: () => void }) {
  const [turn, setTurn] = useState<Turn>(() => session.nextTurn());
  const [entry, setEntry] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ line: string; d: Diagnosis } | null>(null);
  const [hints, setHints] = useState(0);
  const [churn, setChurn] = useState(0);
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
    setFeedback({ line: res.line.text, d: res.diagnosis });
    if (turn.challengeDoorOffered && !res.attempt.correct) setDoorOpen(true);
    onTick();
  };

  const answered = feedback !== null;

  const stageStyle = useMemo(
    () => ({ background: world.palette.bg, color: world.palette.ink, borderColor: 'rgba(255,255,255,0.09)' }),
    [world],
  );

  return (
    <div className="grid two">
      <div>
        <div className="stage" style={stageStyle}>
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
            <div className="bubble">
              {answered ? feedback!.line : turn.line.text}
              {answered && feedback!.d.errorClass === 'misconception' && feedback!.d.misconception && (
                <div className="tiny" style={{ marginTop: 8, opacity: 0.8 }}>
                  “{MISCONCEPTIONS[feedback!.d.misconception].belief}”
                </div>
              )}
            </div>
          </div>

          <div className="controls">
            {!answered ? (
              <>
                <button className="btn primary" onClick={submit}>
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
              <button className="btn primary" onClick={reset}>Next</button>
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

        <details className="why">
          <summary>Why this item? (engine view — never shown to a child)</summary>
          <div>
            <b className="mono">{turn.selection.reason}</b> · concept <b className="mono">{p.concept}</b> ·
            surface <b className="mono">{p.representation}</b> · difficulty <b className="mono">{p.difficulty.toFixed(2)}</b> ·
            personalization <b className="mono">{session.model.policy.personalization}</b>
            {turn.rendered?.isControl && <> · <b className="mono">control item</b></>}
            <p style={{ marginTop: 8 }}>{turn.selection.rationale}</p>
            {turn.rendered?.isControl && (
              <p style={{ marginTop: 8 }}>
                Held deliberately generic. Roughly one story item in six skips personalization
                so this child's engagement with and without it can be compared — otherwise
                "personalization helps" is an assumption the product can never check.
              </p>
            )}
            {turn.intervention && (
              <p style={{ marginTop: 8 }}>
                Intervention <b className="mono">{turn.intervention.id}</b> chosen because it runs on the{' '}
                <b>{turn.intervention.representation}</b> surface, which is where this child is strongest.
              </p>
            )}
          </div>
        </details>
      </div>

      <LiveModel session={session} />
    </div>
  );
}

function LiveModel({ session }: { session: Session }) {
  const m = session.model;
  const t = m.traits;
  const bugs = Object.entries(m.misconceptions).filter(([, v]) => v && v.status !== 'resolved');

  return (
    <div className="card">
      <h2>What the game currently believes</h2>

      <div className="rows" style={{ marginBottom: 16 }}>
        <Meter label="Confidence" v={t.confidence} />
        <Meter label="Frustration" v={t.frustration} invert />
        <Meter label="Perseverance" v={t.perseverance} />
        <Meter label="Rushing" v={t.impulsivity} invert />
      </div>

      <h2>Surfaces</h2>
      <div className="rows" style={{ marginBottom: 16 }}>
        {(['manipulative', 'symbolic', 'story'] as const).map((r) => (
          <div className="row" key={r}>
            <div className="name">
              <span>{r}</span>
              <div className="bar" style={{ flex: 1 }}>
                <i style={{ width: `${Math.round((t.repAffinity[r] + 1) * 50)}%` }} />
              </div>
            </div>
            <span className="mono tiny" style={{ textAlign: 'right' }}>
              {t.repAffinity[r] >= 0 ? '+' : ''}{t.repAffinity[r].toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <h2>Current policy</h2>
      <div className="small muted" style={{ display: 'grid', gap: 4, marginBottom: 16 }}>
        <div>world · <b style={{ color: 'var(--ink)' }}>{m.policy.world}</b></div>
        <div>surface · <b style={{ color: 'var(--ink)' }}>{m.policy.representation}</b></div>
        <div>tone · <b style={{ color: 'var(--ink)' }}>{m.policy.companionTone}</b></div>
        <div>hints · <b style={{ color: 'var(--ink)' }}>{m.policy.hintTiming}</b></div>
        <div>timer · <b style={{ color: 'var(--ink)' }}>{m.policy.timePressure ? 'on' : 'off'}</b></div>
        <div>difficulty · <b style={{ color: 'var(--ink)' }}>{m.policy.difficulty.toFixed(2)}</b></div>
        <div>personalization · <b style={{ color: 'var(--ink)' }}>{m.policy.personalization}</b></div>
      </div>

      <h2>Wrong rules</h2>
      {bugs.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>None detected yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {bugs.map(([id, v]) => (
            <div key={id}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{MISCONCEPTIONS[id as keyof typeof MISCONCEPTIONS].label}</b>
                <span className={`pill ${v!.status === 'confirmed' ? 'bad' : v!.status === 'resolving' ? 'warn' : ''}`}>
                  {v!.status} · {v!.fires}×
                </span>
              </div>
              <p className="tiny muted" style={{ margin: '4px 0 0', lineHeight: 1.55 }}>
                “{MISCONCEPTIONS[id as keyof typeof MISCONCEPTIONS].belief}”
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Meter({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const bad = invert ? v > 0.55 : v < 0.35;
  return (
    <div className="row">
      <div className="name">
        <span>{label}</span>
        <div className="bar" style={{ flex: 1 }}>
          <i style={{ width: `${Math.round(v * 100)}%`, background: bad ? 'var(--warn)' : 'var(--accent)' }} />
        </div>
      </div>
      <span className="mono tiny" style={{ textAlign: 'right' }}>{v.toFixed(2)}</span>
    </div>
  );
}
