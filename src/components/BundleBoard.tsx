import { useEffect, useState } from 'react';
import type { World } from '../engine/worlds';

/**
 * The manipulative surface — and the reason the whole game holds together.
 *
 * A number here is a physical thing: ten loose units snap into one bundle, and
 * a bundle can be broken back open. That single affordance *is* place value,
 * carrying and borrowing. A child who carries a ten has physically bundled ten
 * ones rather than remembered a mark above a column, and a child who tries to
 * take eight from two discovers that they cannot — so the buggy move is not
 * available to choose rather than merely discouraged.
 *
 * It is also the diagnostic. "Forgot to carry" is not an inference here; it is
 * twelve loose cubes sitting in a tray, with the child pressing Done.
 */

export function BundleBoard({
  world, target, value, onChange, lockOnes, showBundleHint,
}: {
  world: World;
  target: number | null;
  value: number;
  onChange: (n: number) => void;
  /** the unbundle ritual: the ones tray cannot exceed nine */
  lockOnes?: boolean;
  showBundleHint?: boolean;
}) {
  const [tens, setTens] = useState(Math.floor(value / 10));
  const [ones, setOnes] = useState(value % 10);

  useEffect(() => { setTens(Math.floor(value / 10)); setOnes(value % 10); }, [value]);
  const push = (t: number, o: number) => { setTens(t); setOnes(o); onChange(t * 10 + o); };

  const overflowing = ones >= 10;

  return (
    <div>
      <div className="trays">
        <div className="tray">
          <div className="label">{world.units[1]}s · tens</div>
          <div className="bundles">
            {Array.from({ length: tens }).map((_, i) => (
              <button
                key={i}
                className="rod"
                style={{ background: world.palette.bundle }}
                title="Break this bundle open into ten"
                onClick={() => push(tens - 1, ones + 10)}
              >
                {Array.from({ length: 10 }).map((__, k) => <span key={k} />)}
              </button>
            ))}
            {tens === 0 && <span className="tiny muted">empty</span>}
          </div>
          <div className="controls" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => push(tens + 1, ones)}>+ bundle</button>
            <button className="btn ghost" disabled={tens === 0} onClick={() => push(tens - 1, ones)}>−</button>
          </div>
        </div>

        <div className="tray">
          <div className="label">
            {world.units[0]}s · ones {lockOnes && <span className="pill warn" style={{ marginLeft: 6 }}>holds 9</span>}
          </div>
          <div className="ones-grid">
            {Array.from({ length: ones }).map((_, i) => (
              <span key={i} className="cube" style={{ background: world.palette.unit }} />
            ))}
          </div>
          {ones === 0 && <span className="tiny muted">empty</span>}
          <div className="controls" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={lockOnes && ones >= 9}
              onClick={() => push(tens, ones + 1)}
            >
              + {world.units[0]}
            </button>
            <button className="btn ghost" disabled={ones === 0} onClick={() => push(tens, ones - 1)}>−</button>
            {overflowing && (
              <button className="btn primary" onClick={() => push(tens + 1, ones - 10)}>
                bundle ten →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="small" style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 22 }}>{tens * 10 + ones}</span>
        {target !== null && <span className="muted">target {target}</span>}
        {overflowing && showBundleHint && (
          <span className="pill warn">
            {ones} loose {world.units[0]}s — a tray only holds nine
          </span>
        )}
      </div>
    </div>
  );
}
