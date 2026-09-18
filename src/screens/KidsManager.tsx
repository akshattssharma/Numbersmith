import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { RestoreBackup } from '../components/RestoreBackup';
import { CHARACTERS } from '../engine/avatars';
import { normaliseName } from '../engine/cast';
import {
  addChild, exportBackup, removeChild, resetHousehold, serializeBackup, switchActiveChild,
  type Household,
} from '../engine/household';

/**
 * Parent-only. Who's playing, add another child, the PIN, a backup, and
 * signing out — all in one place, because these are the things a household
 * actually needs to manage and none of them belong anywhere a child can reach.
 */
export function KidsManager({
  household, onChange, onRestore, onSetPin, onSignOut,
}: {
  household: Household;
  onChange: (h: Household) => void;
  /** distinct from onChange: a restore replaces the household wholesale and
   *  the caller needs to know to drop any cached Session, not just re-render
   *  with new state. */
  onRestore: (h: Household) => void;
  onSetPin: (pin: string) => void;
  /** also distinct from onChange: a sign-out drops the cached Session AND
   *  reintroduces the product from Landing, since a different family may be
   *  the very next person to use this browser. */
  onSignOut: () => void;
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
      <BackupCard household={household} onRestore={onRestore} />
      <SignOutCard household={household} onSignOut={onSignOut} />
    </div>
  );
}

function downloadBackup(household: Household) {
  const backup = exportBackup(household);
  const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `numbersmith-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function BackupCard({ household, onRestore }: { household: Household; onRestore: (h: Household) => void }) {
  return (
    <div className="card">
      <h2>Backup &amp; restore</h2>
      <p className="small muted" style={{ marginTop: -6 }}>
        Everyone's progress lives only in this browser — nothing is sent anywhere. Download a
        backup file before switching devices or clearing browser data, and restore it to bring
        every child back.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button className="btn ghost tiny" onClick={() => downloadBackup(household)}>
          Download backup
        </button>
      </div>
      <RestoreBackup currentChildren={household.children.map((c) => c.name)} onRestore={onRestore} />
    </div>
  );
}

function SignOutCard({ household, onSignOut }: { household: Household; onSignOut: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const names = household.children.map((c) => c.name).join(', ');

  return (
    <div className="card">
      <h2>Sign out</h2>
      <p className="small muted" style={{ marginTop: -6 }}>
        There's no account to sign out of — this clears every child and the PIN from this browser
        so someone else can set up their own family here instead.
      </p>
      {!confirming ? (
        <button className="btn ghost tiny" onClick={() => setConfirming(true)}>Sign out</button>
      ) : (
        <div className="insight" style={{ borderColor: 'var(--bad)' }}>
          <b>Remove {names || 'everyone'} from this browser?</b>
          <p>
            All their progress goes with them, right now, on this device — there's no undo unless
            you have a backup file already.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost tiny" onClick={() => downloadBackup(household)}>
              Download a backup first
            </button>
            <button
              className="btn tiny"
              style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
              onClick={onSignOut}
            >
              Yes, sign out
            </button>
            <button className="btn ghost tiny" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
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
