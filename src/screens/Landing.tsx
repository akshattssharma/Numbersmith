const BASE = import.meta.env.BASE_URL;

/**
 * The very first thing anyone sees — before Onboarding, before there's a
 * child to set up at all. Pasting the bare URL used to drop a visitor
 * straight onto "who's playing?", which reads as a form, not an
 * introduction: nothing on that screen says what this is or why a parent
 * should spend the minute it takes to fill it in.
 *
 * Pure marketing copy and a single decision (get started or not) — no
 * pedagogy, no state, which is why this lives in screens/ with no engine
 * import at all. Restoring a backup on a new device is deliberately NOT
 * duplicated here: Onboarding's first screen already has that control, and
 * this page's whole job is to end at Onboarding, not to re-solve it.
 */
export function Landing({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="landing">
      <img className="landing-icon" src={`${BASE}icons/icon-192.png`} width={88} height={88} alt="" />
      <h1 className="landing-title">Numbersmith</h1>
      <p className="landing-tag">
        A maths game for grades 2–3 that models how a child thinks, not just whether they were right.
      </p>
      <p className="landing-intro">
        Most "adaptive" apps only ever nudge a difficulty slider. Numbersmith looks at <i>why</i> an
        answer was wrong — the specific rule a child is following — and adjusts the whole game around
        it, not just how hard the next question is.
      </p>

      <div className="landing-features">
        <div className="landing-feature">
          <span className="landing-feature-icon">🔍</span>
          <div>
            <b>Finds the actual mistake</b>
            <p>A wrong answer is usually a consistent, specific rule — not a random slip. Numbersmith recognises it and works on that, not just the topic.</p>
          </div>
        </div>
        <div className="landing-feature">
          <span className="landing-feature-icon">🧭</span>
          <div>
            <b>Adapts the whole experience</b>
            <p>The world, how a question is asked, the pacing, even the companion's tone all shift to fit your child — not just a difficulty number.</p>
          </div>
        </div>
        <div className="landing-feature">
          <span className="landing-feature-icon">🔒</span>
          <div>
            <b>Stays on this device</b>
            <p>No accounts, no ads, nothing ever sent anywhere. Progress can be backed up to a file whenever you'd like one.</p>
          </div>
        </div>
      </div>

      <button className="btn primary landing-cta" onClick={onGetStarted}>Get started</button>
      <p className="tiny muted landing-note">
        About a minute — a short parent PIN and your child's first name is all it takes.
      </p>
    </div>
  );
}
