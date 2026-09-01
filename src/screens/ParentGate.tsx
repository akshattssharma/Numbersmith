import { useState } from 'react';
import { checkPin, type Household } from '../engine/household';

/**
 * The speed bump between a child's screen and a grown-up's.
 *
 * This is a static site with no server, so there is no real login to build —
 * anything that looks like "authentication" here would be theatre. What this
 * actually is: a 4-digit PIN, chosen by the parent, checked entirely on this
 * device. Its job is not to stop a determined adult, it is to stop a curious
 * seven-year-old from tapping into settings mid-game.
 */
export function ParentGate({
  household, onUnlock, onCancel, onSetPin,
}: {
  household: Household;
  onUnlock: () => void;
  onCancel: () => void;
  /** used only by the "forgot PIN" reset path below */
  onSetPin: (pin: string) => void;
}) {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState(false);
  const [resetting, setResetting] = useState(false);

  const tap = (d: string) => {
    setError(false);
    const next = (entry + d).slice(0, 4);
    setEntry(next);
    if (next.length === 4) {
      if (checkPin(household, next)) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setEntry(''), 380);
      }
    }
  };

  if (resetting) {
    return (
      <ResetPin
        onDone={(pin) => { onSetPin(pin); onUnlock(); }}
        onCancel={() => setResetting(false)}
      />
    );
  }

  return (
    <div className="card gatecard">
      <h2>Grown-ups only</h2>
      <p className="small muted" style={{ marginTop: 0 }}>Enter the parent PIN to continue.</p>

      <div className={`pindots ${error ? 'err' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < entry.length ? 'filled' : ''} />
        ))}
      </div>

      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="key" onClick={() => tap(d)}>{d}</button>
        ))}
        <button className="key ghost" onClick={() => setEntry('')}>Clear</button>
        <button className="key" onClick={() => tap('0')}>0</button>
        <button className="key ghost" onClick={onCancel}>Back</button>
      </div>

      <button
        className="btn ghost tiny"
        style={{ marginTop: 14 }}
        onClick={() => setResetting(true)}
      >
        Forgot the PIN?
      </button>
    </div>
  );
}

/**
 * There is no email, no account, nowhere to send a reset link — so "forgot
 * password" cannot mean what it usually means. What it can mean: a check that
 * is easy for an adult and hard for the child the PIN exists to slow down,
 * gating the one thing that matters here, which is setting a new PIN.
 */
function ResetPin({ onDone, onCancel }: { onDone: (pin: string) => void; onCancel: () => void }) {
  const [a] = useState(() => 4 + Math.floor(Math.random() * 5));
  const [b] = useState(() => 6 + Math.floor(Math.random() * 5));
  const [check, setCheck] = useState('');
  const [passed, setPassed] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');

  if (!passed) {
    return (
      <div className="card gatecard">
        <h2>Reset the parent PIN</h2>
        <p className="small muted" style={{ marginTop: 0, lineHeight: 1.6 }}>
          There's no server here to email you a reset link, so instead: an adult check.
          What is <b style={{ color: 'var(--ink)' }}>{a} × {b}</b>?
        </p>
        <input
          className="text-in" inputMode="numeric" autoFocus
          value={check} onChange={(e) => setCheck(e.target.value.replace(/\D/g, ''))}
          style={{ fontSize: 20, width: 100, textAlign: 'center' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button
            className="btn primary"
            disabled={Number(check) !== a * b}
            onClick={() => setPassed(true)}
          >
            Continue
          </button>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  const ready = pin1.length === 4 && pin1 === pin2;

  return (
    <div className="card gatecard">
      <h2>Set a new PIN</h2>
      <p className="small muted" style={{ marginTop: 0 }}>Four digits. Something the kids don't already know.</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 200 }}>
        <input
          className="text-in" inputMode="numeric" placeholder="New PIN" maxLength={4}
          value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <input
          className="text-in" inputMode="numeric" placeholder="Confirm PIN" maxLength={4}
          value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn primary" disabled={!ready} onClick={() => onDone(pin1)}>
          Save PIN
        </button>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
