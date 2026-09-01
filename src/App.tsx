import { useRef, useState } from 'react';
import { saveProfile, type PersonalProfile } from './engine/cast';
import {
  addChild, loadHousehold, loadChildSave, saveChildSave, saveHousehold, setPin,
  type ChildSave, type Household,
} from './engine/household';
import { Session } from './engine/session';
import { BrainView } from './screens/BrainView';
import { FiveChildren } from './screens/FiveChildren';
import { KidsManager } from './screens/KidsManager';
import { Onboarding } from './screens/Onboarding';
import { ParentGate } from './screens/ParentGate';
import { ParentView } from './screens/ParentView';
import { Play } from './screens/Play';
import { Setup } from './screens/Setup';
import './styles/app.css';

type Mode = 'kid' | 'gate' | 'parent';
type ParentTab = 'kids' | 'setup' | 'brain' | 'parent' | 'children';

const PARENT_TABS: { id: ParentTab; label: string; note: string }[] = [
  { id: 'kids', label: 'Kids', note: 'who’s playing, PIN' },
  { id: 'setup', label: 'Their world', note: 'cast and favourites' },
  { id: 'parent', label: 'Parent', note: 'insight, not analytics' },
  { id: 'brain', label: 'The brain', note: 'engine, made inspectable' },
  { id: 'children', label: 'Five children', note: 'the thesis, tested' },
];

export default function App() {
  const [household, setHousehold] = useState<Household>(() => loadHousehold());
  const [mode, setMode] = useState<Mode>('kid');
  const [parentTab, setParentTab] = useState<ParentTab>('kids');
  const [, force] = useState(0);

  const activeId = household.activeChildId;
  const activeMeta = household.children.find((c) => c.id === activeId);

  // One Session per active child, rebuilt only when the active child changes.
  const sessionRef = useRef<{ id: string | null; session: Session | null }>({ id: null, session: null });
  if (activeId && sessionRef.current.id !== activeId) {
    const save: ChildSave = loadChildSave(activeId, activeMeta?.name ?? 'Player');
    sessionRef.current = {
      id: activeId,
      session: new Session(save.model, Date.now() & 0xffff, save.profile, save.struggle, save.index),
    };
  }
  const session = sessionRef.current.session;

  const persistActive = () => {
    if (activeId && session) saveChildSave(activeId, session.exportSave());
  };

  const updateHousehold = (h: Household) => { saveHousehold(h); setHousehold(h); };

  // First run: no children yet at all. One short setup, then straight into play.
  if (household.children.length === 0) {
    return (
      <div className="app onboard-app">
        <header className="masthead">
          <h1>Numbersmith</h1>
          <span className="tag">a maths game that models how a child thinks, not just whether they were right</span>
        </header>
        <Onboarding
          onComplete={(name, characterId, pin) => {
            const withChild = addChild(household, name, characterId);
            updateHousehold(setPin(withChild, pin));
          }}
        />
      </div>
    );
  }

  if (!session || !activeMeta) {
    return (
      <div className="app">
        <p className="small muted">Loading…</p>
      </div>
    );
  }

  if (mode === 'kid') {
    return (
      <div className="app kid-app">
        <Play
          session={session}
          childName={activeMeta.name}
          onTick={() => { persistActive(); force((n) => n + 1); }}
          onExitToParent={() => { persistActive(); setMode('gate'); }}
        />
      </div>
    );
  }

  if (mode === 'gate') {
    return (
      <div className="app gate-app">
        <ParentGate
          household={household}
          onUnlock={() => setMode('parent')}
          onCancel={() => setMode('kid')}
          onSetPin={(pin) => updateHousehold(setPin(household, pin))}
        />
      </div>
    );
  }

  // mode === 'parent'
  return (
    <div className="app">
      <header className="masthead">
        <h1>Numbersmith</h1>
        <span className="tag">a maths game that models how a child thinks, not just whether they were right</span>
        <button
          className="btn primary tiny"
          style={{ marginLeft: 'auto' }}
          onClick={() => { persistActive(); setMode('kid'); }}
        >
          ▶ Back to the game{activeMeta ? ` — ${activeMeta.name}` : ''}
        </button>
      </header>

      <nav className="tabs" role="tablist">
        {PARENT_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={parentTab === t.id}
            onClick={() => setParentTab(t.id)}
          >
            {t.label} <span className="tiny muted" style={{ marginLeft: 4 }}>· {t.note}</span>
          </button>
        ))}
      </nav>

      {parentTab === 'kids' && (
        <KidsManager
          household={household}
          onChange={(h) => updateHousehold(h)}
          onSetPin={(pin) => updateHousehold(setPin(household, pin))}
        />
      )}
      {parentTab === 'setup' && (
        <Setup
          profile={session.profile}
          onChange={(p: PersonalProfile) => {
            session.profile = p;
            saveProfile(p);
            persistActive();
            force((n) => n + 1);
          }}
        />
      )}
      {parentTab === 'brain' && <BrainView session={session} />}
      {parentTab === 'parent' && <ParentView session={session} />}
      {parentTab === 'children' && <FiveChildren />}
    </div>
  );
}
