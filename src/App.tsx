import { useRef, useState } from 'react';
import { saveProfile, type PersonalProfile } from './engine/cast';
import {
  addChild, loadHousehold, loadChildSave, resetHousehold, saveChildSave, saveHousehold, setPin,
  type ChildSave, type Household,
} from './engine/household';
import { Session } from './engine/session';
import { BrainView } from './screens/BrainView';
import { FiveChildren } from './screens/FiveChildren';
import { KidsManager } from './screens/KidsManager';
import { Landing } from './screens/Landing';
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
  // Shown once, before Onboarding, only while there are no children yet —
  // pasting the bare URL used to land straight on "who's playing?", which
  // reads as a form with no introduction. Flips false for the rest of the
  // session the moment "Get started" is clicked, so removing every child
  // later drops a returning parent straight back into Onboarding instead
  // of re-explaining the product to someone who just used it.
  const [showLanding, setShowLanding] = useState(true);

  const activeId = household.activeChildId;
  const activeMeta = household.children.find((c) => c.id === activeId);

  // One Session per active child, rebuilt only when the active child changes.
  const sessionRef = useRef<{ id: string | null; session: Session | null }>({ id: null, session: null });
  if (activeId && sessionRef.current.id !== activeId) {
    const save: ChildSave = loadChildSave(activeId, activeMeta?.name ?? 'Player');
    const session = new Session(
      save.model, Date.now() & 0xffff, save.profile, save.struggle,
      save.index, save.quest, save.questNumber, save.sittingEnded,
      save.stars, save.collection, save.soundOn,
    );
    // Their last sitting already reached its own end — opening the app again
    // is the next visit, so it starts a fresh one rather than resuming a
    // sitting that already resolved.
    if (save.sittingEnded) session.beginSitting();
    sessionRef.current = { id: activeId, session };
  }
  const session = sessionRef.current.session;

  const persistActive = () => {
    if (activeId && session) saveChildSave(activeId, session.exportSave());
  };

  const updateHousehold = (h: Household) => { saveHousehold(h); setHousehold(h); };

  // A restore already wrote its own household + saves to storage (applyBackup),
  // so this just needs to drop the cached Session — otherwise the next
  // autosave tick would overwrite the just-restored save with the stale one
  // still held in memory.
  const restoreHousehold = (h: Household) => {
    sessionRef.current = { id: null, session: null };
    setHousehold(h);
  };

  // Distinct from restoreHousehold: a sign-out means a genuinely different
  // family may pick this browser up next, so — unlike an ordinary empty
  // roster from removing a mistaken entry — it's worth showing Landing
  // again rather than dropping straight into Onboarding.
  const signOut = () => {
    const empty = resetHousehold(household);
    sessionRef.current = { id: null, session: null };
    setShowLanding(true);
    setMode('kid');
    setParentTab('kids');
    setHousehold(empty);
  };

  // First run: no children yet at all. A brief introduction, then one short
  // setup, then straight into play.
  if (household.children.length === 0) {
    if (showLanding) {
      return (
        <div className="app landing-app">
          <Landing onGetStarted={() => setShowLanding(false)} />
        </div>
      );
    }
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
          onRestore={restoreHousehold}
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
          onRestore={restoreHousehold}
          onSetPin={(pin) => updateHousehold(setPin(household, pin))}
          onSignOut={signOut}
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
