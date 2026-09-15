import { useState } from 'react';
import { motion } from 'framer-motion';
import { ALL_CONCEPTS, CONCEPTS } from '../engine/conceptGraph';
import { isReady, mastery } from '../engine/learnerModel';
import type { ConceptId, LearnerModel } from '../engine/types';

/**
 * The kid-facing version of the concept graph — the "Math Brain" the original
 * design brief asked for, built as the reward itself rather than a debug
 * panel. BrainView (parent-only) shows confidence, frustration, misconception
 * status, a "why this item" trace; a child sees none of that here. Only two
 * kid-safe fields from CONCEPTS ever reach this screen: `label` and `gist`,
 * both already written in plain, encouraging language — never a percentage,
 * never a concept a child hasn't reached yet.
 *
 * Nodes are hand-positioned by branch and prerequisite depth (three arms —
 * place value/addition, subtraction, multiplication — fanning up from a
 * shared trunk), not computed by a layout engine: fourteen fixed nodes don't
 * need one, and hand placement is what makes it read as a constellation
 * rather than a graph diagram.
 *
 * A concept stays invisible until it's ready — the sky fills in as the child
 * progresses, rather than showing fourteen greyed-out locked dots on day one,
 * which would read as a wall of homework rather than a sky worth watching
 * grow. Ready-but-not-mastered is a dim, steady star; mastered is a bright,
 * gently pulsing one — the rare, real event the biggest reward tier is for.
 */

const LAYOUT: Record<ConceptId, { angle: number; ring: number }> = {
  'number-sense': { angle: 270, ring: 0 },
  'counting-on': { angle: 270, ring: 1.4 },
  'number-bonds-10': { angle: 245, ring: 2.6 },
  'skip-counting': { angle: 200, ring: 2.6 },
  'add-within-20': { angle: 297, ring: 3.1 },
  'place-value-2digit': { angle: 230, ring: 3.9 },
  'equal-groups': { angle: 188, ring: 3.9 },
  'sub-within-20': { angle: 313, ring: 4.1 },
  'add-2digit-nocarry': { angle: 252, ring: 4.9 },
  'arrays': { angle: 178, ring: 5.0 },
  'sub-2digit-noborrow': { angle: 322, ring: 5.1 },
  'add-2digit-carry': { angle: 246, ring: 5.9 },
  'mult-facts-2-5-10': { angle: 174, ring: 6.0 },
  'sub-2digit-borrow': { angle: 328, ring: 6.1 },
};

const CX = 220;
const CY = 386;
const R0 = 34;

function pos(c: ConceptId) {
  const { angle, ring } = LAYOUT[c];
  const rad = (angle * Math.PI) / 180;
  return { x: CX + ring * R0 * Math.cos(rad), y: CY + ring * R0 * Math.sin(rad) };
}

export function Constellation({ model }: { model: LearnerModel }) {
  const [openId, setOpenId] = useState<ConceptId | null>(null);
  const visible = new Set(ALL_CONCEPTS.filter((c) => isReady(model, c)));

  return (
    <div className="constellation-wrap">
      <svg viewBox="-10 0 460 420" className="constellation-svg">
        {ALL_CONCEPTS.flatMap((c) =>
          CONCEPTS[c].prereqs
            .filter((p) => visible.has(c) && visible.has(p))
            .map((p) => {
              const a = pos(p);
              const b = pos(c);
              return <line key={`${p}-${c}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="constellation-edge" />;
            }),
        )}

        {ALL_CONCEPTS.filter((c) => visible.has(c)).map((c) => {
          const m = mastery(model, c);
          const isMastered = m >= 0.85;
          const { x, y } = pos(c);
          return (
            <motion.g
              key={c}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              onClick={() => setOpenId(c)}
              className="constellation-node"
            >
              {/* Pulsing via `scale`, not by animating `r` directly — SVG
                  geometry attributes don't tween reliably through Framer
                  Motion's array-keyframe path, `transform` does. Origin is
                  set explicitly because SVG's default is the viewport
                  corner, not the shape's own center. */}
              {isMastered && (
                <motion.circle
                  cx={x} cy={y} r={15} className="constellation-halo"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                  animate={{ scale: [1, 1.27, 1], opacity: [0.5, 0.15, 0.5] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <motion.circle
                cx={x} cy={y}
                r={isMastered ? 9 : 5.5}
                className={isMastered ? 'constellation-star mastered' : 'constellation-star'}
                style={isMastered ? { transformOrigin: `${x}px ${y}px` } : undefined}
                animate={isMastered ? { scale: [1, 1.17, 1] } : {}}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.g>
          );
        })}
      </svg>

      {openId && (
        <div className="constellation-tip" onClick={() => setOpenId(null)}>
          <b>{CONCEPTS[openId].label}</b>
          <p>{CONCEPTS[openId].gist}</p>
        </div>
      )}
    </div>
  );
}
