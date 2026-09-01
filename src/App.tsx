import { useRef, useState } from 'react';
import { Session } from './engine/session';
import { BrainView } from './screens/BrainView';
import { FiveChildren } from './screens/FiveChildren';
import { ParentView } from './screens/ParentView';
import { Play } from './screens/Play';
import './styles/app.css';

type Tab = 'play' | 'children' | 'brain' | 'parent';

const TABS: { id: Tab; label: string; note: string }[] = [
  { id: 'play', label: 'Play', note: 'the child-facing loop' },
  { id: 'children', label: 'Five children', note: 'the thesis, tested' },
  { id: 'brain', label: 'The brain', note: 'engine, made inspectable' },
  { id: 'parent', label: 'Parent', note: 'insight, not analytics' },
];

export default function App() {
  const session = useRef(new Session(undefined, Date.now() & 0xffff)).current;
  const [tab, setTab] = useState<Tab>('children');
  const [, force] = useState(0);

  return (
    <div className="app">
      <header className="masthead">
        <h1>Numbersmith</h1>
        <span className="tag">
          a maths game that models how a child thinks, not just whether they were right
        </span>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span className="tiny muted" style={{ marginLeft: 4 }}>· {t.note}</span>
          </button>
        ))}
      </nav>

      {tab === 'play' && <Play session={session} onTick={() => force((n) => n + 1)} />}
      {tab === 'children' && <FiveChildren />}
      {tab === 'brain' && <BrainView session={session} />}
      {tab === 'parent' && <ParentView session={session} />}
    </div>
  );
}
