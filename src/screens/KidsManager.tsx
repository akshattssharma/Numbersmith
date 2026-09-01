import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CHARACTERS } from '../engine/avatars';
import { normaliseName } from '../engine/cast';
import { addChild, removeChild, switchActiveChild, type Household } from '../engine/household';

/**
 * Parent-only. Who's playing, add another child, and the PIN — all in one
 * place, because these are the three things a household actually needs to
 * manage and none of them belong anywhere a child can reach.
 */
export function KidsManager({
  household, onChange, onSetPin,
}: {
  household: Household;
  onChange: (h: Household) => void;
  onSetPin: (pin: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Who's playing</h2>
          <button className="btn ghost tiny" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : '+ Add a child'}
          </button>
        </div>

        {adding && (
          <AddChildForm
            existing={household.children.map((c) => c.characterId)}
            onAdd={(name, charId) => { onChange(addChild(household, name, charId)); setAdding(false); }}
          />
        )}

        {household.children.length === 0 ? (
          <p className="small muted" style={{ marginTop: 14 }}>No children yet — add one above.</p>
        ) : (
          <div className="kids" style={{ marginTop: 16 }}>
            {household.children.map((c) => {
              const active = c.id === household.activeChildId;
              return (
                <div key={c.id} className="kid" style={{ borderColor: active ? 'var(--accent)' : 'var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar characterId={c.characterId} size={40} ring={active} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>{c.name}</h3>
                      {active && <span className="pill good">playing now</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    {!active && (
                      <button
                        className="btn tiny"
                        onClick={() => onChange(switchActiveChild(household, c.id))}
                      >
                        Switch to {c.name}
                      </button>
                    )}
                    {confirmRemove === c.id ? (
                      <>
                        <span className="tiny muted">Remove {c.name} and their progress?</span>
                        <button
                          className="btn tiny"
                          style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
                          onClick={() => { onChange(removeChild(household, c.id)); setConfirmRemove(null); }}
                        >
                          Yes, remove
                        </button>
                        <button className="btn ghost tiny" onClick={() => setConfirmRemove(null)}>Cancel</button>
                      </>
                    ) : (
                      household.children.length > 1 && (
                        <button className="btn ghost tiny" onClick={() => setConfirmRemove(c.id)}>Remove</button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PinCard household={household} onSetPin={onSetPin} />
    </div>
  );
}

function AddChildForm({ existing, onAdd }: { existing: string[]; onAdd: (name: string, charId: string) => void }) {
  const [name, setName] = useState('');
  const [charId, setCharId] = useState(CHARACTERS.find((c) => !existing.includes(c.id))?.id ?? CHARACTERS[0].id);
  const clean = normaliseName(name);

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span className="label">First name</span>
          <input
            className="text-in" value={name} maxLength={14} autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && clean && onAdd(clean, charId)}
          />
        </label>
        <button className="btn primary" disabled={!clean} onClick={() => onAdd(clean, charId)}>Add</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CHARACTERS.slice(0, 24).map((c) => (
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
            <Avatar characterId={c.id} size={34} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PinCard({ household, onSetPin }: { household: Household; onSetPin: (pin: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const ready = pin1.length === 4 && pin1 === pin2;

  return (
    <div className="card">
      <h2>Parent PIN</h2>
      {!editing ? (
        <button className="btn ghost tiny" onClick={() => setEditing(true)}>
          {household.pin ? 'Change PIN' : 'Set a PIN'}
        </button>
      ) : (
        <div>
          <div style={{ display: 'grid', gap: 10, maxWidth: 200, marginBottom: 10 }}>
            <input
              className="text-in" inputMode="numeric" placeholder="New PIN" maxLength={4}
              value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <input
              className="text-in" inputMode="numeric" placeholder="Confirm PIN" maxLength={4}
              value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn primary" disabled={!ready}
              onClick={() => { onSetPin(pin1); setEditing(false); setPin1(''); setPin2(''); }}
            >
              Save
            </button>
            <button className="btn ghost" onClick={() => { setEditing(false); setPin1(''); setPin2(''); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
