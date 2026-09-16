import { useRef, useState } from 'react';
import { applyBackup, parseBackup, type Backup, type Household } from '../engine/household';

/**
 * Shared by two very different moments: a parent tidying up in the Kids tab,
 * and a brand-new device that has no children yet and can't reach that tab —
 * onboarding is unconditional whenever household.children.length === 0, so a
 * restore path has to exist there too, or "carry it to a new device" is a
 * promise the app can't actually keep.
 */
export function RestoreBackup({
  currentChildren, onRestore, buttonLabel = 'Restore from a file', buttonClassName = 'btn ghost tiny',
}: {
  /** names of children already on this device, for the overwrite warning —
   *  an empty array (onboarding, nothing here yet) shows no warning at all */
  currentChildren: string[];
  onRestore: (h: Household) => void;
  buttonLabel?: string;
  buttonClassName?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    setPending(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBackup(String(reader.result));
      if (!parsed) { setError("That file doesn't look like a Numbersmith backup."); return; }
      setPending(parsed);
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  };

  return (
    <div>
      <button className={buttonClassName} onClick={() => fileRef.current?.click()}>{buttonLabel}</button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />

      {error && <p className="tiny" style={{ color: 'var(--bad)', marginBottom: 0, marginTop: 8 }}>{error}</p>}

      {pending && (
        <div className="insight" style={{ marginTop: 14 }}>
          <b>
            Restore {pending.household.children.length === 1
              ? pending.household.children[0].name
              : `${pending.household.children.length} children`}?
          </b>
          <p>
            This file was saved on {new Date(pending.exportedAt).toLocaleDateString()} and has{' '}
            {pending.household.children.map((c) => c.name).join(', ') || 'no children'}.
            {currentChildren.length > 0 && (
              <> It replaces {currentChildren.join(', ')} currently on this device — that progress
              is not merged, it's overwritten.</>
            )}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn primary tiny"
              onClick={() => { onRestore(applyBackup(pending)); setPending(null); }}
            >
              Yes, restore
            </button>
            <button className="btn ghost tiny" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
