import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { RestoreBackup } from '../components/RestoreBackup';
import { CHARACTERS } from '../engine/avatars';
import { normaliseName } from '../engine/cast';
import type { Household } from '../engine/household';

/**
 * The very first screen, ever. One child, one PIN, then straight into the
 * game — everything else (more children, the cast, favourites) can be added
 * later from the parent side without ever blocking play.
 *
 * Also the only place a device with zero children can reach a restore: the
 * app shows this screen unconditionally whenever household.children is
 * empty, so "carry your backup to a new device" has to start here, not in
 * the Kids tab a fresh device can't get to yet.
 */
export function Onboarding({
  onComplete, onRestore,
}: {
  onComplete: (childName: string, characterId: string, pin: string) => void;
  onRestore: (h: Household) => void;
}) {
  const [step, setStep] = useState<'child' | 'pin'>('child');
  const [name, setName] = useState('');
  const [charId, setCharId] = useState(CHARACTERS[0].id);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');

  const clean = normaliseName(name);

  if (step === 'child') {
    return (
      <div className="card gatecard" style={{ maxWidth: 480 }}>
        <h2>Welcome — who's playing?</h2>
        <p className="small muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
          This is set up by a grown-up, once. The child's screen after this is just the game —
          no forms, no settings.
        </p>
        <label style={{ display: 'grid', gap: 5, marginBottom: 16 }}>
          <span className="label">Child's first name</span>
          <input
            className="text-in" value={name} maxLength={14} autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya"
          />
        </label>
        <div className="label" style={{ marginBottom: 8 }}>Pick a character for them</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
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
              <Avatar characterId={c.id} size={38} />
            </button>
          ))}
        </div>
        <button className="btn primary" disabled={!clean} onClick={() => setStep('pin')}>
          Next
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <p className="tiny muted" style={{ marginTop: 0, marginBottom: 8 }}>
            Setting up on a new device? Restore a backup from another one instead of starting over.
          </p>
          <RestoreBackup currentChildren={[]} onRestore={onRestore} />
        </div>
      </div>
    );
  }

  const ready = pin1.length === 4 && pin1 === pin2;

  return (
    <div className="card gatecard" style={{ maxWidth: 480 }}>
      <h2>Set a parent PIN</h2>
      <p className="small muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
        Four digits, so {clean || 'they'} can play without wandering into settings, and you can
        get back in whenever you want to check progress or add someone else. It stays on this
        device — there's no account and nothing is sent anywhere.
      </p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 200, marginBottom: 16 }}>
        <input
          className="text-in" inputMode="numeric" placeholder="Choose a PIN" maxLength={4}
          value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <input
          className="text-in" inputMode="numeric" placeholder="Confirm PIN" maxLength={4}
          value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn ghost" onClick={() => setStep('child')}>Back</button>
        <button
          className="btn primary" disabled={!ready}
          onClick={() => onComplete(clean, charId, pin1)}
        >
          Start playing
        </button>
      </div>
    </div>
  );
}
