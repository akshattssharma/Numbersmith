import { motion } from 'framer-motion';

/**
 * The flight path connecting effort to accumulation — the piece the original
 * critique named directly: "a counter felt meaningless partly because
 * nothing ever traveled into it." Manually positioned (ref rects in, deltas
 * out) rather than Framer Motion's layoutId magic-move: a one-shot spawn-
 * fly-vanish is easier to reason about and time precisely with plain
 * from/to coordinates than with layout-diffing between two elements that
 * only briefly coexist.
 */
export function RewardFlight({
  from, to, icon, big, onDone,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  icon: string;
  big?: boolean;
  onDone: () => void;
}) {
  return (
    <motion.div
      className="reward-flight"
      style={{ left: from.x, top: from.y, fontSize: big ? 28 : 18 }}
      initial={{ x: 0, y: 0, scale: 0.5, opacity: 1 }}
      animate={{ x: to.x - from.x, y: to.y - from.y, scale: big ? 1.3 : 0.9, opacity: [1, 1, 0] }}
      transition={{ duration: big ? 0.85 : 0.5, ease: 'easeIn' }}
      onAnimationComplete={onDone}
    >
      {icon}
    </motion.div>
  );
}
