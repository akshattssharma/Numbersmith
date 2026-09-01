import { ALL_CONCEPTS, CONCEPTS, topoOrder } from '../engine/conceptGraph';
import { mastery } from '../engine/learnerModel';
import { INTERVENTIONS } from '../engine/interventions';
import { MISCONCEPTIONS, ALL_MISCONCEPTIONS } from '../engine/misconceptions';
import { isReady } from '../engine/learnerModel';
import type { Session } from '../engine/session';

/**
 * The engine, made inspectable.
 *
 * A child never sees this. It exists because an adaptive system that cannot be
 * read is a system nobody can debug, review or trust — and "the model decided"
 * is not an acceptable answer when the subject is a seven-year-old's education.
 */

export function BrainView({ session }: { session: Session }) {
  const m = session.model;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="grid two">
        <div className="card">
          <h2>Concept graph · mastery</h2>
          <div className="rows">
            {topoOrder().map((c) => {
              const v = mastery(m, c);
              const raw = m.concepts[c].pKnow;
              const capped = raw - v > 0.02;
              const ready = isReady(m, c);
              return (
                <div className="row" key={c}>
                  <div className="name">
                    <span style={{ opacity: ready ? 1 : 0.45 }}>{CONCEPTS[c].label}</span>
                    <div className={`bar ${capped ? 'capped' : ''}`} style={{ flex: 1 }}>
                      <i style={{ width: `${Math.round(v * 100)}%` }} />
                    </div>
                  </div>
                  <span className="mono tiny" style={{ textAlign: 'right' }}>
                    {capped ? `${(v * 100).toFixed(0)}◂${(raw * 100).toFixed(0)}` : `${(v * 100).toFixed(0)}%`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Dimmed rows are locked — their prerequisites are not in place yet. An amber bar with two
            numbers means a confirmed wrong rule is holding mastery below the raw knowledge estimate:
            the child is getting answers right by a method that will fail them later, and averaging
            that into a single score would hide exactly the thing worth knowing.
          </p>
        </div>

        <div className="card">
          <h2>Misconception library</h2>
          <div style={{ display: 'grid', gap: 11 }}>
            {ALL_MISCONCEPTIONS.map((id) => {
              const st = m.misconceptions[id];
              const d = MISCONCEPTIONS[id];
              return (
                <div key={id} style={{ opacity: st ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13 }}>{d.label}</b>
                    <span className="pill tiny">{d.specificity}</span>
                    {st && (
                      <span className={`pill tiny ${st.status === 'confirmed' ? 'bad' : st.status === 'resolved' ? 'good' : 'warn'}`}>
                        {st.status} · {st.fires}×
                      </span>
                    )}
                  </div>
                  <p className="tiny muted" style={{ margin: '3px 0 0', lineHeight: 1.5 }}>“{d.belief}”</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Intervention log — the asset being accumulated</h2>
        <p className="small muted" style={{ marginTop: 0, maxWidth: '76ch', lineHeight: 1.65 }}>
          Every repair attempt is written down as{' '}
          <span className="mono">(misconception, intervention, surface, outcome)</span>. At one
          child this is a debugging aid. At scale it answers the question no question bank can:
          not "is this child stuck" but "what has actually worked, for children who were stuck in
          this specific way, on this specific surface". That table is the thing a competitor
          cannot copy by copying the artwork — which is why it is logged from the first session
          rather than once there is scale to justify it.
        </p>
        {m.interventionLog.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing logged yet — no wrong rule has been confirmed in this session.
            The Five Children tab shows populated logs.
          </p>
        ) : (
          <table className="matrix">
            <thead>
              <tr><th>Misconception</th><th>Intervention</th><th>Surface</th><th>Item</th><th>Outcome</th></tr>
            </thead>
            <tbody>
              {m.interventionLog.map((l, i) => (
                <tr key={i}>
                  <td>{MISCONCEPTIONS[l.misconception].label}</td>
                  <td className="mono">{l.intervention}</td>
                  <td>{l.representation}</td>
                  <td className="mono">{l.at}</td>
                  <td>
                    <span className={`pill tiny ${l.outcome === 'better' ? 'good' : l.outcome === 'pending' ? '' : 'warn'}`}>
                      {l.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Intervention library ({INTERVENTIONS.length} written, {ALL_CONCEPTS.length} concepts)</h2>
        <div style={{ display: 'grid', gap: 13 }}>
          {INTERVENTIONS.map((iv) => (
            <div key={iv.id}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b className="mono" style={{ fontSize: 12.5 }}>{iv.id}</b>
                <span className="pill tiny">{iv.representation}</span>
                <span className="tiny muted">for {MISCONCEPTIONS[iv.for].label.toLowerCase()}</span>
              </div>
              <p className="tiny muted" style={{ margin: '4px 0 0', lineHeight: 1.6 }}>{iv.action}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
