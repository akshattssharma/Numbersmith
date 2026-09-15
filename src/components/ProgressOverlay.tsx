import { Constellation } from './Constellation';
import { WorldCollection } from './WorldCollection';
import { WORLD_IDS, WORLDS } from '../engine/worlds';
import type { LearnerModel, WorldId } from '../engine/types';

/**
 * "Somewhere to go admire it" without adding a new kid-facing navigation
 * tab — kid mode stays one screen (Play), reached by tapping the star chip
 * rather than a second tab living alongside "Grown-ups". Dismissible back
 * to the game by tapping the backdrop, the same close button, or Escape.
 */
export function ProgressOverlay({
  model, collection, onClose,
}: {
  model: LearnerModel;
  collection: Record<WorldId, number>;
  onClose: () => void;
}) {
  return (
    <div className="progress-overlay" onClick={onClose} role="dialog" aria-label="Your progress">
      <div className="progress-card" onClick={(e) => e.stopPropagation()}>
        <div className="progress-head">
          <h2>Your progress</h2>
          <button className="btn ghost tiny" onClick={onClose}>Close ✕</button>
        </div>

        <div className="progress-sub">Your sky</div>
        <Constellation model={model} />

        <div className="progress-sub">Your worlds</div>
        <div className="progress-worlds">
          {WORLD_IDS.map((w) => (
            <div key={w} className="progress-world">
              <div className="progress-world-name" style={{ color: WORLDS[w].palette.accent }}>{WORLDS[w].name}</div>
              <WorldCollection world={WORLDS[w]} count={collection[w]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
