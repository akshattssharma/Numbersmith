import { useMemo, useState } from 'react';
import { CONCEPTS } from '../engine/conceptGraph';
import { MISCONCEPTIONS } from '../engine/misconceptions';
import { divergenceReport, runAllJourneys, type Journey } from '../engine/simulate';
import type { Representation } from '../engine/types';
import { WORLDS } from '../engine/worlds';

/**
 * The thesis, on one screen.
 *
 * Five simulated children are handed the identical opening and run through the
 * same engine the playable tab uses. Nothing here is scripted — the engine
 * picks every item and the personas react. What the screen shows is how far
 * apart the five experiences end up, and, more importantly, *why*.
 */

const REP_COLOUR: Record<Representation, string> = {
  manipulative: '#5eead4',
  symbolic: '#a78bfa',
  story: '#fbbf24',
};

export function FiveChildren() {
  const [turns, setTurns] = useState(30);
  const journeys = useMemo(() => runAllJourneys(turns), [turns]);
  const report = useMemo(() => divergenceReport(journeys), [journeys]);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <h2>The claim being tested</h2>
        <p className="small" style={{ margin: '0 0 12px', maxWidth: '72ch', lineHeight: 1.65 }}>
          Five children start from the identical opening. After {turns} items the engine has
          built five different games — different worlds, different surfaces, different concept
          paths, a different companion, different pacing. Every difference below traces back to
          something the child actually did, and no persona was ever routed by hand.
        </p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="small muted">
            session length{' '}
            <input
              type="range" min={12} max={60} value={turns}
              onChange={(e) => setTurns(Number(e.target.value))}
              style={{ verticalAlign: 'middle', marginLeft: 8 }}
            />{' '}
            <b className="mono" style={{ color: 'var(--ink)' }}>{turns}</b>
          </label>
          <span className="pill good">
            every pair differs on ≥ {report.minPairDifference} of 10 dimensions
          </span>
          <span className="pill">mean {report.meanPairDifference.toFixed(1)} / 10</span>
        </div>
      </div>

      <div className="kids">
        {journeys.map((j) => (
          <KidCard key={j.persona.id} j={j} onOpen={() => setOpen(open === j.persona.id ? null : j.persona.id)} />
        ))}
      </div>

      <div className="card">
        <h2>Where the five journeys separate</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="matrix">
            <thead>
              <tr>
                <th>Dimension</th>
                {journeys.map((j) => <th key={j.persona.id}>{j.persona.name}</th>)}
              </tr>
            </thead>
            <tbody>
              <Row label="World" get={(j) => WORLDS[j.summary.world].name} js={journeys} />
              <Row label="Dominant surface" get={(j) => dom(j)} js={journeys} />
              <Row label="Companion tone" get={(j) => j.summary.tone} js={journeys} />
              <Row label="Hints" get={(j) => j.summary.hintTiming} js={journeys} />
              <Row label="Timer" get={(j) => (j.summary.timePressure ? 'on' : 'off')} js={journeys} />
              <Row label="Mean difficulty" get={(j) => j.summary.meanDifficulty.toFixed(2)} js={journeys} />
              <Row label="Depth reached" get={(j) => CONCEPTS[j.summary.conceptsTouched[j.summary.conceptsTouched.length - 1]].label} js={journeys} />
              <Row label="Concepts touched" get={(j) => String(j.summary.conceptsTouched.length)} js={journeys} />
              <Row label="Session length" get={(j) => String(j.summary.sessionTarget)} js={journeys} />
              <Row
                label="Wrong rules found"
                get={(j) => j.summary.misconceptionsFound.filter((x) => x.status !== 'suspected').map((x) => MISCONCEPTIONS[x.id].label).join('; ') || '—'}
                js={journeys}
              />
              <Row label="Interventions used" get={(j) => j.summary.interventions.join(', ') || '—'} js={journeys} />
            </tbody>
          </table>
        </div>
        <div className="legend">
          {(['manipulative', 'symbolic', 'story'] as Representation[]).map((r) => (
            <span key={r}><i style={{ background: REP_COLOUR[r] }} />{r}</span>
          ))}
          <span className="muted">
            ribbons above show the surface served on each item, in order
          </span>
        </div>
      </div>

      {open && <Detail j={journeys.find((x) => x.persona.id === open)!} />}
    </div>
  );
}

function KidCard({ j, onOpen }: { j: Journey; onOpen: () => void }) {
  const w = WORLDS[j.summary.world];
  return (
    <div className="kid">
      <h3>{j.persona.name}</h3>
      <p className="blurb">{j.persona.blurb}</p>

      <div className="ribbon" title="surface served, item by item">
        {j.steps.map((s, i) => (
          <i
            key={i}
            style={{
              background: REP_COLOUR[s.representation],
              opacity: s.correct ? 1 : 0.34,
            }}
          />
        ))}
      </div>

      <dl>
        <dt>world</dt><dd>{w.name}</dd>
        <dt>companion</dt><dd>{w.companion}, {j.summary.tone}</dd>
        <dt>difficulty</dt><dd>{j.summary.meanDifficulty.toFixed(2)}</dd>
        <dt>accuracy</dt><dd>{Math.round(j.summary.accuracy * 100)}%</dd>
        <dt>timer</dt><dd>{j.summary.timePressure ? 'on' : 'off'}</dd>
      </dl>

      {j.summary.misconceptionsFound.filter((x) => x.status !== 'suspected').map((x) => (
        <div key={x.id} className="pill bad" style={{ marginTop: 10 }}>
          {MISCONCEPTIONS[x.id].label}
        </div>
      ))}

      <button className="btn ghost" style={{ marginTop: 12, width: '100%' }} onClick={onOpen}>
        Read the trace
      </button>
    </div>
  );
}

function Detail({ j }: { j: Journey }) {
  return (
    <div className="grid two">
      <div className="card">
        <h2>{j.persona.name} — item by item</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          <b style={{ color: 'var(--ink)' }}>What a teacher would say:</b> “{j.persona.teacherNote}”
        </p>
        <div className="trace">
          {j.steps.map((s) => (
            <div key={s.index} className={`item ${s.correct ? 'ok' : 'no'}`}>
              <b className="mono">{String(s.index + 1).padStart(2, '0')}</b>{' '}
              <span className="mono" style={{ color: REP_COLOUR[s.representation] }}>{s.representation}</span>{' '}
              <span className="mono muted">{s.concept}</span>{' '}
              <span className="pill tiny">{s.reason}</span>{' '}
              {!s.correct && <span className="pill bad tiny">{s.errorClass}</span>}
              {s.intervention && <span className="pill warn tiny"> {s.intervention}</span>}
              <div className="tiny muted" style={{ marginTop: 3 }}>{s.rationale}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>What {j.persona.name}'s parent sees</h2>
        {j.insights.map((i, k) => (
          <div key={k} className={`insight ${i.kind}`}>
            <b>{i.headline}</b>
            <p>{i.body}</p>
          </div>
        ))}
        <p className="tiny muted" style={{ lineHeight: 1.6 }}>{j.framing}</p>
      </div>
    </div>
  );
}

function Row({ label, get, js }: { label: string; get: (j: Journey) => string; js: Journey[] }) {
  const vals = js.map(get);
  const allSame = new Set(vals).size === 1;
  return (
    <tr>
      <th>{label}</th>
      {vals.map((v, i) => (
        <td key={i} style={{ color: allSame ? 'var(--muted)' : 'var(--ink)' }}>{v}</td>
      ))}
    </tr>
  );
}

const dom = (j: Journey) =>
  Object.entries(j.summary.representationMix).sort((a, b) => b[1] - a[1])[0][0];
