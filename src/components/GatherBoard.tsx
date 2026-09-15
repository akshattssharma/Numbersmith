import { useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import type { World } from '../engine/worlds';

/**
 * The gather surface — equal-groups made physical, and dragged rather than
 * typed or tapped.
 *
 * Every other kind reduces to "adjust a number until it matches." This one
 * doesn't: the child drags a unit from the supply into one of `b` group
 * cells, repeatedly, until they judge the total is right. Nothing enforces a
 * cap of `a` per cell — overfilling or leaving a cell short is exactly the
 * mistake this concept's misconceptions describe (mult-one-group-off,
 * mult-added-instead), so the interaction has to allow it rather than
 * politely prevent it.
 *
 * The parent is responsible for one thing this component never sees: timing.
 * Each commit calls `onDrop` and the caller stamps the clock — that's what
 * turns a sequence of drops into a real, engine-side signal (dragStrategy.ts)
 * for "filled a group at once" vs "placed these one at a time", without
 * putting any of that inference in a UI file.
 *
 * Assumes it is remounted (via a `key`) whenever the problem changes — `b`
 * is read once, at mount, on that assumption, rather than reconciled against
 * a changing prop.
 */
export function GatherBoard({
  world, a, b, onChange, onDrop,
}: {
  world: World;
  /** the size a group is meant to hold — shown as a label, never enforced */
  a: number;
  /** number of group cells */
  b: number;
  onChange: (n: number) => void;
  /** fires once per committed drop, with the cell it landed in */
  onDrop: (cellIndex: number) => void;
}) {
  const [counts, setCounts] = useState<number[]>(() => Array(b).fill(0));
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [gen, setGen] = useState(0); // remount key for the token — resets its position after every drag
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cellAt = (x: number, y: number): number | null => {
    for (let i = 0; i < cellRefs.current.length; i++) {
      const el = cellRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  };
  // info.point's coordinate space isn't guaranteed viewport-relative the way
  // getBoundingClientRect() is; subtracting scroll makes the two agree either
  // way, and is a no-op on an unscrolled page.
  const pointCell = (info: PanInfo) => cellAt(info.point.x - window.scrollX, info.point.y - window.scrollY);

  const commit = (next: number[]) => {
    setCounts(next);
    onChange(next.reduce((s, n) => s + n, 0));
  };

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const cell = pointCell(info);
    setHoverCell(null);
    setGen((g) => g + 1);
    if (cell === null) return;
    const next = counts.slice();
    next[cell] += 1;
    commit(next);
    onDrop(cell);
  };

  const removeOne = (i: number) => {
    if (!counts[i]) return;
    const next = counts.slice();
    next[i] -= 1;
    commit(next);
  };

  const unit = world.units[0];

  return (
    <div className="gather">
      <div className="gathercells">
        {counts.map((n, i) => (
          <div
            key={i}
            ref={(el) => { cellRefs.current[i] = el; }}
            className={`gathercell ${hoverCell === i ? 'hover' : ''}`}
          >
            <div className="gathercell-label">Group {i + 1}</div>
            <div className="gathercell-dots">
              {n === 0
                ? <span className="tiny muted">empty</span>
                : Array.from({ length: n }, (_, k) => (
                  <span key={k} className="cube" style={{ background: world.palette.unit }} />
                ))}
            </div>
            {n > 0 && (
              <button className="btn ghost tiny gathercell-minus" onClick={() => removeOne(i)}>−1</button>
            )}
          </div>
        ))}
      </div>

      <div className="gathersupply">
        <motion.div
          key={gen}
          className="gathertoken"
          style={{ background: world.palette.unit }}
          drag
          dragMomentum={false}
          dragElastic={0.15}
          whileDrag={{ scale: 1.2, zIndex: 5 }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          onDrag={(_e, info) => setHoverCell(pointCell(info))}
          onDragEnd={handleDragEnd}
        />
        <span className="small muted">drag a {unit} into a group</span>
      </div>

      <div className="small muted" style={{ marginTop: 8 }}>{b} groups of {a}</div>
    </div>
  );
}
