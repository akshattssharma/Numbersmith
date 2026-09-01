import { characterById, type Character } from '../engine/avatars';

/**
 * A character, drawn from parts. No image files, no network, no generation
 * step — so it renders instantly, works offline, and looks identical for every
 * child who picks it.
 */

export function Avatar({
  characterId, size = 44, name, ring,
}: {
  characterId: string;
  size?: number;
  name?: string;
  ring?: boolean;
}) {
  const c = characterById(characterId);
  const [body, accent, detail] = c.palette;

  const bodyPath = {
    round: 'M32 12c11 0 17 8 17 19s-6 19-17 19-17-8-17-19S21 12 32 12Z',
    tall:  'M32 9c9 0 15 7 15 17v13c0 8-6 13-15 13s-15-5-15-13V26c0-10 6-17 15-17Z',
    wide:  'M32 15c13 0 20 7 20 16s-7 19-20 19-20-10-20-19 7-16 20-16Z',
    bean:  'M32 11c11 0 16 9 16 18 0 10-5 21-16 21s-16-11-16-21c0-9 5-18 16-18Z',
    blob:  'M32 12c12 0 18 6 18 17 0 12-7 21-18 21s-18-9-18-21c0-11 6-17 18-17Z',
  }[c.shape];

  return (
    <span
      style={{
        display: 'inline-grid', placeItems: 'center', flex: 'none',
        width: size, height: size, borderRadius: '50%',
        background: ring ? `${body}22` : 'transparent',
        boxShadow: ring ? `inset 0 0 0 2px ${accent}55` : 'none',
      }}
      title={name}
    >
      <svg width={size * 0.88} height={size * 0.88} viewBox="0 0 64 64" role="img"
           aria-label={name ? `${name}'s character` : 'character'}>
        {/* ears sit behind the body so they read as attached */}
        {c.ears === 'round' && (
          <>
            <circle cx="18" cy="17" r="7" fill={accent} />
            <circle cx="46" cy="17" r="7" fill={accent} />
          </>
        )}
        {c.ears === 'pointy' && (
          <>
            <path d="M17 22 15 6l13 8Z" fill={accent} />
            <path d="M47 22 49 6l-13 8Z" fill={accent} />
          </>
        )}
        {c.ears === 'long' && (
          <>
            <rect x="20" y="2" width="7" height="20" rx="3.5" fill={accent} />
            <rect x="37" y="2" width="7" height="20" rx="3.5" fill={accent} />
          </>
        )}
        {c.ears === 'antenna' && (
          <>
            <path d="M32 12V4" stroke={accent} strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="3" r="4" fill={accent} />
          </>
        )}

        <path d={bodyPath} fill={body} />

        {c.pattern === 'belly' && <ellipse cx="32" cy="40" rx="10" ry="9" fill={accent} opacity="0.45" />}
        {c.pattern === 'spots' && (
          <>
            <circle cx="24" cy="38" r="3.2" fill={accent} opacity="0.5" />
            <circle cx="40" cy="34" r="2.4" fill={accent} opacity="0.5" />
            <circle cx="36" cy="44" r="2.8" fill={accent} opacity="0.5" />
          </>
        )}
        {c.pattern === 'stripe' && (
          <path d="M32 14v36" stroke={accent} strokeWidth="4" opacity="0.4" strokeLinecap="round" />
        )}

        {/* eyes */}
        {c.eyes === 'dots' && (
          <>
            <circle cx="26" cy="30" r="2.6" fill={detail} />
            <circle cx="38" cy="30" r="2.6" fill={detail} />
          </>
        )}
        {c.eyes === 'big' && (
          <>
            <circle cx="26" cy="30" r="5" fill="#fff" />
            <circle cx="38" cy="30" r="5" fill="#fff" />
            <circle cx="27" cy="31" r="2.5" fill={detail} />
            <circle cx="39" cy="31" r="2.5" fill={detail} />
          </>
        )}
        {c.eyes === 'wide' && (
          <>
            <ellipse cx="25" cy="30" rx="4" ry="5" fill="#fff" />
            <ellipse cx="39" cy="30" rx="4" ry="5" fill="#fff" />
            <circle cx="25" cy="31" r="2" fill={detail} />
            <circle cx="39" cy="31" r="2" fill={detail} />
          </>
        )}
        {c.eyes === 'sleepy' && (
          <>
            <path d="M22 30q4 4 8 0" stroke={detail} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M34 30q4 4 8 0" stroke={detail} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* mouth */}
        {c.mouth === 'smile' && <path d="M27 39q5 4 10 0" stroke={detail} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        {c.mouth === 'grin' && <path d="M25 38q7 7 14 0Z" fill={detail} opacity="0.85" />}
        {c.mouth === 'small' && <circle cx="32" cy="39" r="1.8" fill={detail} />}
        {c.mouth === 'oh' && <ellipse cx="32" cy="39.5" rx="2.6" ry="3.4" fill={detail} opacity="0.85" />}
      </svg>
    </span>
  );
}

export function AvatarChip({ characterId, name }: { characterId: string; name: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <Avatar characterId={characterId} size={26} name={name} />
      <b style={{ fontSize: 14 }}>{name}</b>
    </span>
  );
}

export type { Character };
