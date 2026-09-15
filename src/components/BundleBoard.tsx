import { useEffect, useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
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
 *
 * Two ways in, on purpose: drag a loose unit into the ones tray or a whole
 * bundle into the tens tray (the tactile version of the physical model above),
 * or use the tap +/- controls each tray already carries — a reliable fallback
 * that never depends on pointer precision. Both write to the same state, so
 * neither is the "real" way to play.
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

  const tensRef = useRef<HTMLDivElement | null>(null);
  const onesRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<'unit' | 'bundle' | null>(null);
  const [hoverZone, setHoverZone] = useState<'tens' | 'ones' | null>(null);
  const [unitGen, setUnitGen] = useState(0);
  const [bundleGen, setBundleGen] = useState(0);

  const zoneAt = (x: number, y: number): 'tens' | 'ones' | null => {
    const inside = (el: HTMLDivElement | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    if (inside(tensRef.current)) return 'tens';
    if (inside(onesRef.current)) return 'ones';
    return null;
  };
  // As in GatherBoard: subtracting scroll makes this agree with
  // getBoundingClientRect() regardless of which coordinate space info.point
  // actually uses, and is a no-op when the page hasn't scrolled.
  const pointZone = (info: PanInfo) => zoneAt(info.point.x - window.scrollX, info.point.y - window.scrollY);

  const dropUnit = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const zone = pointZone(info);
    setHoverZone(null);
    setDragging(null);
    setUnitGen((g) => g + 1);
    // A loose unit only ever means "one more one" — dropped on the tens
    // tray, or missed entirely, it's a no-op rather than a guess at intent.
    if (zone === 'ones' && !(lockOnes && ones >= 9)) push(tens, ones + 1);
  };

  const dropBundle = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const zone = pointZone(info);
    setHoverZone(null);
    setDragging(null);
    setBundleGen((g) => g + 1);
    if (zone === 'tens') push(tens + 1, ones);
  };

  const [unit, bundle] = world.units;

  return (
    <div>
      <div className="trays">
        <div className={`tray ${dragging === 'bundle' && hoverZone === 'tens' ? 'hover' : ''}`} ref={tensRef}>
          <div className="label">{bundle}s · tens</div>
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

        <div className={`tray ${dragging === 'unit' && hoverZone === 'ones' ? 'hover' : ''}`} ref={onesRef}>
          <div className="label">
            {unit}s · ones {lockOnes && <span className="pill warn" style={{ marginLeft: 6 }}>holds 9</span>}
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
              + {unit}
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

      <div className="bbsupply">
        <div className="bbsupply-item">
          <motion.div
            key={unitGen}
            className="cube draggable"
            style={{ background: world.palette.unit }}
            drag
            dragMomentum={false}
            dragElastic={0.15}
            whileDrag={{ scale: 1.4, zIndex: 5 }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onDragStart={() => setDragging('unit')}
            onDrag={(_e, info) => setHoverZone(pointZone(info))}
            onDragEnd={dropUnit}
          />
          <span className="tiny muted">drag a {unit} into ones</span>
        </div>
        <div className="bbsupply-item">
          <motion.div
            key={bundleGen}
            className="rod draggable"
            style={{ background: world.palette.bundle }}
            drag
            dragMomentum={false}
            dragElastic={0.15}
            whileDrag={{ scale: 1.2, zIndex: 5 }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onDragStart={() => setDragging('bundle')}
            onDrag={(_e, info) => setHoverZone(pointZone(info))}
            onDragEnd={dropBundle}
          >
            {Array.from({ length: 10 }).map((_, k) => <span key={k} />)}
          </motion.div>
          <span className="tiny muted">drag a {bundle} of ten into tens</span>
        </div>
      </div>

      <div className="small" style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 10 }}>
        <span className="mono" style={{ fontSize: 22 }}>{tens * 10 + ones}</span>
        {target !== null && <span className="muted">target {target}</span>}
        {overflowing && showBundleHint && (
          <span className="pill warn">
            {ones} loose {unit}s — a tray only holds nine
          </span>
        )}
      </div>
    </div>
  );
}
