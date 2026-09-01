import { useState } from 'react';
import { answerParentQuestion, generateInsights, PARENT_QUESTIONS, progressFraming } from '../engine/parentInsights';
import type { Session } from '../engine/session';

/**
 * The parent product.
 *
 * Deliberately not a dashboard. There is no accuracy percentage anywhere on
 * this screen, because a percentage is a number a parent cannot act on and can
 * easily be frightened by. The questions are a fixed list rather than a chat
 * box for the same reason the companion is: a bounded surface is a promise you
 * can actually keep.
 */

export function ParentView({ session }: { session: Session }) {
  const m = session.model;
  const insights = generateInsights(m);
  const [q, setQ] = useState<string | null>(null);

  if (m.history.length < 3) {
    return (
      <div className="card">
        <h2>Parent view</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Play a few items on the Play tab first — insights are generated from the live learner
          model, not from a template, so there needs to be something in it. The Five Children tab
          shows fully-populated parent views for each simulated child.
        </p>
      </div>
    );
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>This week</h2>
        {insights.map((i, k) => (
          <div key={k} className={`insight ${i.kind}`}>
            <b>{i.headline}</b>
            <p>{i.body}</p>
          </div>
        ))}
        <p className="tiny muted" style={{ lineHeight: 1.6, marginBottom: 0 }}>{progressFraming(m)}</p>
      </div>

      <div className="card">
        <h2>Ask</h2>
        <div style={{ display: 'grid', gap: 7 }}>
          {PARENT_QUESTIONS.map((question) => (
            <button
              key={question}
              className="btn ghost"
              style={{ textAlign: 'left' }}
              onClick={() => setQ(q === question ? null : question)}
            >
              {question}
            </button>
          ))}
        </div>
        {q && (
          <div className="insight" style={{ marginTop: 16 }}>
            <b>{q}</b>
            <p>{answerParentQuestion(m, q as typeof PARENT_QUESTIONS[number])}</p>
          </div>
        )}
        <details className="why">
          <summary>Why a fixed list rather than a chat box?</summary>
          <div>
            Every answer on this screen is assembled from the learner model by code we can read
            and test. A model may later rephrase these into warmer English, but it does not decide
            what is true about a child and it does not hold an open conversation about them. That
            is a bound we can promise a parent and then actually keep — and it is a much stronger
            claim than "we filter the output".
          </div>
        </details>
      </div>
    </div>
  );
}
