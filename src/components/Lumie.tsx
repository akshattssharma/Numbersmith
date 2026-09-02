/**
 * Lumie — the one companion character across the whole game.
 *
 * There's a single piece of art (see public/world-art/lumie.png, cut from the
 * child's own reference mockup). Personality comes from motion, not from
 * swapping images: an idle float, a happy bounce with a sparkle burst on a
 * correct answer, and a slower, sympathetic tilt on a wrong one. A mood prop
 * picks the animation class; the art itself never changes.
 */

export type LumieMood = 'idle' | 'happy' | 'gentle' | 'thinking';

const BASE = import.meta.env.BASE_URL;

export function Lumie({ mood = 'idle', size = 72 }: { mood?: LumieMood; size?: number }) {
  return (
    <div className={`lumie lumie-${mood}`} style={{ width: size, height: size }}>
      {mood === 'happy' && (
        <>
          <span className="lumie-spark s1">✦</span>
          <span className="lumie-spark s2">✦</span>
          <span className="lumie-spark s3">✧</span>
        </>
      )}
      <img src={`${BASE}world-art/lumie.png`} alt="Lumie" draggable={false} />
    </div>
  );
}
