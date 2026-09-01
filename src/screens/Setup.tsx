import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { availableCharacters, CHARACTERS } from '../engine/avatars';
import {
  byCategory, CATEGORY_LABELS, itemById, normaliseName, saveProfile,
  type CastMember, type FavouriteCategory, type PersonalProfile,
} from '../engine/cast';

/**
 * Setup, split in two on purpose.
 *
 * The parent half handles the part that carries risk — real first names of real
 * children. It is gated, it takes first names only, and the field enforces that
 * rather than politely requesting it.
 *
 * The child half handles the part that should be fun. No typing, no reading
 * required: tap the pictures you like. A seven-year-old can complete it alone
 * in under a minute, which is the only bar that matters, and everything they
 * pick is a starting guess the engine then revises from how they actually play.
 */

const CATEGORIES: FavouriteCategory[] = ['fruit', 'snack', 'animal', 'game', 'toy', 'place'];

export function Setup({
  profile, onChange,
}: {
  profile: PersonalProfile;
  onChange: (p: PersonalProfile) => void;
}) {
  const [tab, setTab] = useState<'child' | 'parent'>('child');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1600);
    return () => clearTimeout(t);
  }, [justSaved]);

  const update = (p: PersonalProfile) => {
    saveProfile(p);
    onChange(p);
    setJustSaved(true);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Making it theirs</h2>
          <span className={`pill good savepill ${justSaved ? 'show' : ''}`}>
            Saved to this device ✓
          </span>
        </div>
        <p className="small" style={{ marginTop: 12, maxWidth: '74ch', lineHeight: 1.65 }}>
          A problem about <em>your</em> friend and <em>your</em> favourite thing lands harder than
          one about anonymous apples. Two halves: the grown-up adds the names, the child taps
          what they like. Everything picked here is a starting guess — the engine revises it
          from how the child actually plays, and quietly measures whether any of it is helping.
          Every tap and every name saves instantly — there is nothing else to click.
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button className={`btn ${tab === 'child' ? 'primary' : 'ghost'}`} onClick={() => setTab('child')}>
            Child · tap what you like
          </button>
          <button className={`btn ${tab === 'parent' ? 'primary' : 'ghost'}`} onClick={() => setTab('parent')}>
            Grown-up · add friends and family
          </button>
        </div>
      </div>

      {tab === 'child'
        ? <Favourites profile={profile} update={update} />
        : <CastEditor profile={profile} update={update} />}
    </div>
  );
}

/* ------------------------------------------------------------------- child */

function Favourites({ profile, update }: { profile: PersonalProfile; update: (p: PersonalProfile) => void }) {
  const toggle = (id: string) => {
    const has = profile.favourites.includes(id);
    update({
      ...profile,
      favourites: has ? profile.favourites.filter((f) => f !== id) : [...profile.favourites, id],
    });
  };

  return (
    <div className="card">
      <h2>Tap the ones you like</h2>
      <p className="small muted" style={{ marginTop: 0 }}>
        Pick a few from each row. {profile.favourites.length} chosen.
      </p>

      {CATEGORIES.map((cat) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div className="label" style={{ marginBottom: 8 }}>{CATEGORY_LABELS[cat]}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {byCategory(cat).map((f) => {
              const on = profile.favourites.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  aria-pressed={on}
                  className="pickable"
                  style={{
                    borderColor: on ? 'var(--accent)' : 'var(--line)',
                    background: on ? 'rgba(94,234,212,0.12)' : 'var(--panel-2)',
                  }}
                >
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{f.icon}</span>
                  <span className="tiny">{f.one}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <details className="why">
        <summary>Why pictures instead of a form?</summary>
        <div>
          The child using this is seven and may not read fluently. A typed list would be
          answered by a parent, which produces what the parent believes the child likes rather
          than what the child does. Tapping is answerable alone, in under a minute — and the
          answers are only a seed anyway. What the engine trusts is what happens during play.
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ parent */

function CastEditor({ profile, update }: { profile: PersonalProfile; update: (p: PersonalProfile) => void }) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<CastMember['relation']>('friend');
  const [charId, setCharId] = useState(availableCharacters(profile.cast.map((c) => c.characterId))[0]?.id ?? CHARACTERS[0].id);

  const add = () => {
    const clean = normaliseName(name);
    if (!clean) return;
    const member: CastMember = {
      id: `p_${clean.toLowerCase()}_${profile.cast.length}`,
      name: clean, relation, characterId: charId,
    };
    update({ ...profile, cast: [...profile.cast, member] });
    setName('');
    const next = availableCharacters([...profile.cast.map((c) => c.characterId), charId])[0];
    if (next) setCharId(next.id);
  };

  const remove = (id: string) =>
    update({ ...profile, cast: profile.cast.filter((c) => c.id !== id) });

  const pool = availableCharacters(profile.cast.map((c) => c.characterId)).slice(0, 24);

  return (
    <div className="grid two">
      <div className="card">
        <h2>Friends and family</h2>

        <div className="note-box">
          <b>First names only, and they stay on this device.</b>
          <p>
            These names are stored in this browser, are never sent to a server — there isn't
            one — and are stripped out of anything that could reach a language model. Some of
            them are other people's children's names, which is why the field below takes a
            first name and discards the rest rather than asking you nicely.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="label">First name</span>
            <input
              className="text-in" value={name} maxLength={14}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Jack"
            />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="label">Who</span>
            <select className="text-in" value={relation} onChange={(e) => setRelation(e.target.value as CastMember['relation'])}>
              <option value="friend">Friend</option>
              <option value="family">Family</option>
            </select>
          </label>
          <button className="btn primary" onClick={add} disabled={!normaliseName(name)}>Add</button>
        </div>

        <div className="label" style={{ marginBottom: 8 }}>Pick their character</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {pool.map((c) => (
            <button
              key={c.id}
              onClick={() => setCharId(c.id)}
              aria-pressed={c.id === charId}
              className="pickable tight"
              style={{
                borderColor: c.id === charId ? 'var(--accent)' : 'var(--line)',
                background: c.id === charId ? 'rgba(94,234,212,0.12)' : 'var(--panel-2)',
              }}
            >
              <Avatar characterId={c.id} size={38} />
            </button>
          ))}
        </div>

        <details className="why">
          <summary>Why a character rather than a picture of the real Jack?</summary>
          <div>
            Generating a likeness of a real child is the highest-risk thing a children's
            product can do, and it buys less than it looks like it does. What makes this
            <em> their </em> Jack is the name and the role, not the resemblance — a purple
            creature called Jack is obviously a character standing for Jack, and children
            read it that way immediately. It also means no photo upload, no per-image cost,
            no waiting mid-game, and nothing to moderate.
          </div>
        </details>
      </div>

      <div className="card">
        <h2>The cast ({profile.cast.length})</h2>
        {profile.cast.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Nobody added yet. The game plays perfectly well without a cast — problems simply
            stay in the second person. Two or three names is plenty; the effect comes from
            recognition, not from volume.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {profile.cast.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Avatar characterId={m.characterId} size={40} name={m.name} ring />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 15 }}>{m.name}</b>
                  <div className="tiny muted">{m.relation}</div>
                </div>
                <button className="btn ghost tiny" onClick={() => remove(m.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="label">What should the game call the child? (optional)</span>
            <input
              className="text-in" maxLength={14} value={profile.childName ?? ''}
              onChange={(e) => update({ ...profile, childName: normaliseName(e.target.value) || undefined })}
              placeholder="Leave blank for “you”"
            />
          </label>
          <p className="tiny muted" style={{ marginTop: 8, lineHeight: 1.55 }}>
            Blank is a perfectly good answer. “You have 4 apples” is shorter than “Maya has 4
            apples”, and shorter sentences are worth more than a name for most children —
            especially the ones who find reading the problem harder than solving it.
          </p>
        </div>
      </div>
    </div>
  );
}
