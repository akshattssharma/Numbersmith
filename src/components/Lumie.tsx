import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Lumie — the one companion character across the whole game.
 *
 * Was a single PNG with four CSS animation classes; personality came from
 * motion applied to a static image. This is the same idea taken further: an
 * SVG built from independent parts (body, eyes, mouth) so the parts can move
 * relative to each other — a blink is the eyes alone, a gasp is the mouth
 * alone, a bounce is the body alone — which reads as *alive* in a way that
 * animating one flat image as a single rigid unit cannot.
 *
 * The one genuinely new behaviour: eyes that track the pointer. Self-
 * contained (a page-level listener, no prop drilling from whatever the child
 * happens to be dragging elsewhere on screen) — during a Gather or
 * BundleBoard drag, that pointer motion is exactly "what the child is doing",
 * so the eyes end up following it for free.
 */

export type LumieMood = 'idle' | 'happy' | 'gentle' | 'thinking' | 'celebrating';

function starPoints(cx: number, cy: number, outerR: number, innerR: number, spikes: number): string {
  const pts: string[] = [];
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
    angle += step;
  }
  return pts.join(' ');
}

const BODY_ANIMATE: Record<LumieMood, any> = {
  idle: { y: [0, -4, 0], rotate: [0, -2, 0, 2, 0], scale: 1 },
  happy: { y: [0, -10, 0], scale: [1, 1.12, 1] },
  gentle: { y: [0, 2, 0], rotate: [0, -4, 0], scale: 0.97 },
  thinking: { rotate: [-3, 3, -3], scale: 1 },
  celebrating: { y: [0, -16, 0, -8, 0], rotate: [0, -8, 8, -8, 0], scale: [1, 1.2, 1.05, 1.2, 1] },
};

const BODY_TRANSITION: Record<LumieMood, any> = {
  idle: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  happy: { duration: 0.6, repeat: 1 },
  gentle: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
  thinking: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
  celebrating: { duration: 1.1, repeat: 2 },
};

export function Lumie({
  mood = 'idle', size = 72,
}: {
  mood?: LumieMood;
  size?: number;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  // Eyes follow the pointer anywhere on the page — a small, clamped offset,
  // not a literal stare. Skipped for moods with their own fixed expression.
  useEffect(() => {
    if (mood === 'thinking' || mood === 'celebrating') return;
    const onMove = (x: number, y: number) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clamp((x - cx) / 140, -1, 1);
      const dy = clamp((y - cy) / 140, -1, 1);
      setGaze({ x: dx, y: dy });
    };
    const pm = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); };
    window.addEventListener('pointermove', pm);
    window.addEventListener('touchmove', tm);
    return () => {
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('touchmove', tm);
    };
  }, [mood]);

  // A blink every few seconds, independent of whatever the body is doing.
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    }, 2600 + Math.random() * 1800);
    return () => clearInterval(id);
  }, []);

  const eyeScaleY = blink ? 0.12 : mood === 'gentle' ? 0.55 : 1;
  const gazeX = mood === 'thinking' ? -0.5 : mood === 'celebrating' ? 0 : gaze.x;
  const gazeY = mood === 'thinking' ? -0.6 : mood === 'celebrating' ? 0 : gaze.y;

  return (
    <div ref={rootRef} className="lumie" style={{ width: size, height: size, position: 'relative' }}>
      {(mood === 'happy' || mood === 'celebrating') && (
        <>
          <span className="lumie-spark s1">✦</span>
          <span className="lumie-spark s2">✦</span>
          <span className="lumie-spark s3">✧</span>
          {mood === 'celebrating' && <span className="lumie-spark s4">✦</span>}
        </>
      )}
      <motion.svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        animate={BODY_ANIMATE[mood]}
        transition={BODY_TRANSITION[mood]}
      >
        <defs>
          <radialGradient id="lumie-glow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#c9f9f1" />
            <stop offset="100%" stopColor="#5eead4" />
          </radialGradient>
        </defs>
        <polygon
          points={starPoints(50, 52, 46, 21, 5)}
          fill="url(#lumie-glow)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {/* eyes */}
        <motion.g animate={{ x: gazeX * 4, y: gazeY * 3 }} transition={{ duration: 0.25 }}>
          <motion.ellipse cx={39} cy={49} rx={5} ry={6 * eyeScaleY} fill="#1a2b3c" />
          <motion.ellipse cx={61} cy={49} rx={5} ry={6 * eyeScaleY} fill="#1a2b3c" />
        </motion.g>
        {/* mouth */}
        <Mouth mood={mood} />
      </motion.svg>
    </div>
  );
}

function Mouth({ mood }: { mood: LumieMood }) {
  // Thinking is a small round "o" (pondering), not a frown — sympathy and
  // curiosity have to look different, or a hint request reads as a scolding.
  if (mood === 'thinking') {
    return <motion.circle cx={50} cy={63} r={3.4} fill="#1a2b3c" initial={false} animate={{ cy: [61, 65, 61] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />;
  }
  const d: Record<Exclude<LumieMood, 'thinking'>, string> = {
    idle: 'M 42 62 Q 50 67 58 62',
    happy: 'M 38 60 Q 50 76 62 60',
    gentle: 'M 42 65 Q 50 61 58 65',
    celebrating: 'M 36 58 Q 50 80 64 58 Q 50 70 36 58',
  };
  return (
    <motion.path
      d={d[mood]}
      fill={mood === 'happy' || mood === 'celebrating' ? '#c0233d' : 'none'}
      stroke="#1a2b3c"
      strokeWidth={2.4}
      strokeLinecap="round"
      initial={false}
      animate={{ d: d[mood] }}
      transition={{ duration: 0.25 }}
    />
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
