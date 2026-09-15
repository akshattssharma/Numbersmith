import { motion } from 'framer-motion';
import type { World } from '../engine/worlds';
import type { WorldId } from '../engine/types';

/**
 * One data shape — a count per world — three reskins, matching each world's
 * own flavour text in `worlds.ts` rather than inventing a fourth vocabulary:
 * starship counts fuel cells toward the next jump, grove meets a new
 * creature, vault turns up another page. Capped visually so a child who
 * plays for months doesn't end up scrolling past two hundred icons — the
 * number keeps counting past the cap, the gallery just stops trying to
 * render all of it.
 */

const NOUN: Record<WorldId, string> = { starship: 'jump', grove: 'creature', vault: 'page' };
const ICON: Record<WorldId, string> = { starship: '\u{1F48E}', grove: '', vault: '\u{1F4DC}' };
/** One representative icon per world — for compact spots (the kidbar chip,
 *  a flight animation) where the full rotating creature set doesn't fit. */
export const CHIP_ICON: Record<WorldId, string> = { starship: '\u{1F48E}', grove: '\u{1F989}', vault: '\u{1F4DC}' };
const EMPTY: Record<WorldId, string> = {
  starship: 'No jumps yet — finish a quest here to fuel one.',
  grove: 'No creatures yet — finish a quest here to meet one.',
  vault: 'No pages yet — finish a quest here to reveal one.',
};
const GROVE_CREATURES = ['\u{1F989}', '\u{1F98A}', '\u{1F43F}️', '\u{1F98B}', '\u{1F438}', '\u{1F422}', '\u{1F994}', '\u{1F430}', '\u{1F98C}', '\u{1F426}'];

const CAP = 12;

export function WorldCollection({ world, count }: { world: World; count: number }) {
  const shown = Math.min(count, CAP);
  const overflow = count - shown;

  return (
    <div className="collection">
      <div className="collection-grid">
        {count === 0 ? (
          <span className="small muted">{EMPTY[world.id]}</span>
        ) : (
          <>
            {Array.from({ length: shown }, (_, i) => (
              <motion.span
                key={i}
                className="collection-item"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16, delay: i * 0.03 }}
              >
                {world.id === 'grove' ? GROVE_CREATURES[i % GROVE_CREATURES.length] : ICON[world.id]}
              </motion.span>
            ))}
            {overflow > 0 && <span className="collection-more">+{overflow}</span>}
          </>
        )}
      </div>
      {count > 0 && (
        <div className="tiny muted" style={{ marginTop: 8 }}>
          {count} {NOUN[world.id]}{count === 1 ? '' : 's'} so far
        </div>
      )}
    </div>
  );
}
