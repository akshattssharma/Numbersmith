import { beforeEach, describe, expect, it } from 'vitest';
import {
  addChild, applyBackup, checkPin, emptyHousehold, exportBackup, loadChildSave,
  loadHousehold, parseBackup, removeChild, saveChildSave, serializeBackup,
  setPin, switchActiveChild, type Household,
} from '../household';

/**
 * The test environment is 'node', which has no localStorage. The engine code
 * degrades gracefully without one (try/catch around every call), but the
 * persistence-specific tests below need a real one to be meaningful, so a
 * minimal in-memory stand-in is installed just for this file.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as any).localStorage = new MemoryStorage();
});

describe('household — pure state transitions', () => {
  it('adding the first child also makes them the active child', () => {
    const h = addChild(emptyHousehold(), 'Maya', 'c00');
    expect(h.children).toHaveLength(1);
    expect(h.activeChildId).toBe(h.children[0].id);
    expect(h.children[0].name).toBe('Maya');
  });

  it('adding a second child does not change who is active', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    const firstId = h.activeChildId;
    h = addChild(h, 'Sam', 'c01');
    expect(h.children).toHaveLength(2);
    expect(h.activeChildId).toBe(firstId);
  });

  it('first names only — a typed surname is discarded, same rule as the cast', () => {
    const h = addChild(emptyHousehold(), 'Maya Rivera', 'c00');
    expect(h.children[0].name).toBe('Maya');
  });

  it('switching to an unknown id is a no-op', () => {
    const h = addChild(emptyHousehold(), 'Maya', 'c00');
    const same = switchActiveChild(h, 'nonexistent');
    expect(same).toBe(h);
  });

  it('switching to a real id changes the active child', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    h = addChild(h, 'Sam', 'c01');
    const samId = h.children[1].id;
    h = switchActiveChild(h, samId);
    expect(h.activeChildId).toBe(samId);
  });

  it('removing the active child promotes another one, not left null with siblings left', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    h = addChild(h, 'Sam', 'c01');
    const mayaId = h.activeChildId!;
    h = removeChild(h, mayaId);
    expect(h.children).toHaveLength(1);
    expect(h.activeChildId).toBe(h.children[0].id);
    expect(h.activeChildId).not.toBe(mayaId);
  });

  it('removing the only child leaves nobody active', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    h = removeChild(h, h.activeChildId!);
    expect(h.children).toHaveLength(0);
    expect(h.activeChildId).toBeNull();
  });

  it('removing an inactive child does not disturb who is active', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    h = addChild(h, 'Sam', 'c01');
    const mayaId = h.activeChildId!;
    const samId = h.children[1].id;
    h = removeChild(h, samId);
    expect(h.activeChildId).toBe(mayaId);
  });
});

describe('household — the parent PIN', () => {
  it('is unset by default, so nothing can match it', () => {
    expect(checkPin(emptyHousehold(), '')).toBe(false);
    expect(checkPin(emptyHousehold(), '1234')).toBe(false);
  });

  it('matches only the exact PIN', () => {
    const h = setPin(emptyHousehold(), '1234');
    expect(checkPin(h, '1234')).toBe(true);
    expect(checkPin(h, '4321')).toBe(false);
    expect(checkPin(h, '123')).toBe(false);
  });
});

describe('household — persistence and migration', () => {
  it('a first run with no storage at all comes back empty, not broken', () => {
    const h = loadHousehold();
    expect(h.children).toHaveLength(0);
    expect(h.activeChildId).toBeNull();
  });

  it('adopts a pre-existing single-child profile as the first child rather than discarding it', () => {
    localStorage.setItem('numbersmith.profile.v1', JSON.stringify({
      childName: 'Akshitha',
      cast: [{ id: 'p_jack_0', name: 'Jack', relation: 'friend', characterId: 'c00' }],
      favourites: ['apple', 'cookie'],
      engagement: {},
      lastUsed: {},
    }));

    const h = loadHousehold();
    expect(h.children).toHaveLength(1);
    expect(h.children[0].name).toBe('Akshitha');
    expect(h.activeChildId).toBe(h.children[0].id);

    // The migrated cast and favourites travel with the new child, not just the name.
    const save = JSON.parse(localStorage.getItem(`numbersmith.child.${h.children[0].id}.v1`)!);
    expect(save.profile.cast).toHaveLength(1);
    expect(save.profile.cast[0].name).toBe('Jack');
    expect(save.profile.favourites).toContain('apple');
  });

  it('a household written to storage is the one read back', () => {
    let h: Household = addChild(emptyHousehold(), 'Maya', 'c00');
    h = setPin(h, '1234');
    localStorage.setItem('numbersmith.household.v1', JSON.stringify(h));

    const reloaded = loadHousehold();
    expect(reloaded.children).toHaveLength(1);
    expect(reloaded.pin).toBe('1234');
  });

  it('a save from before stars/collection existed loads with both defaulted, not missing', () => {
    // A real pre-point-3/4/5 save: no stars field, no collection field at all.
    localStorage.setItem('numbersmith.child.c_old.v1', JSON.stringify({
      index: 12, quest: null, questNumber: 2, sittingEnded: false,
    }));

    const save = loadChildSave('c_old', 'Riley');
    expect(save.stars).toBe(0);
    expect(save.collection).toEqual({ starship: 0, grove: 0, vault: 0 });
    expect(save.soundOn).toBe(true);
  });

  it('a save from before soundOn existed defaults to sound on, not off', () => {
    localStorage.setItem('numbersmith.child.c_presound.v1', JSON.stringify({
      index: 3, quest: null, questNumber: 0, sittingEnded: false, stars: 2, collection: {},
    }));

    const save = loadChildSave('c_presound', 'Riley');
    expect(save.soundOn).toBe(true);
  });

  it('an explicit soundOn: false in a save is respected, not overridden by the default', () => {
    localStorage.setItem('numbersmith.child.c_muted.v1', JSON.stringify({
      index: 3, quest: null, questNumber: 0, sittingEnded: false, stars: 2, collection: {}, soundOn: false,
    }));

    const save = loadChildSave('c_muted', 'Riley');
    expect(save.soundOn).toBe(false);
  });

  it('a save with a partial collection still gets every world, not just the ones it had', () => {
    localStorage.setItem('numbersmith.child.c_partial.v1', JSON.stringify({
      index: 5, quest: null, questNumber: 1, sittingEnded: false,
      stars: 7, collection: { starship: 3 },
    }));

    const save = loadChildSave('c_partial', 'Riley');
    expect(save.stars).toBe(7);
    expect(save.collection).toEqual({ starship: 3, grove: 0, vault: 0 });
  });
});

describe('household — local export/import backup', () => {
  it('exports every child, not just the active one', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    h = addChild(h, 'Sam', 'c01');
    const backup = exportBackup(h);
    expect(Object.keys(backup.children).sort()).toEqual([...h.children.map((c) => c.id)].sort());
  });

  it('round-trips through serialize/parse/apply back to the exact same state', () => {
    let h = addChild(emptyHousehold(), 'Maya', 'c00');
    h = setPin(h, '1234');
    const mayaId = h.activeChildId!;
    const save = loadChildSave(mayaId, 'Maya');
    saveChildSave(mayaId, { ...save, stars: 42 });

    const backup = exportBackup(h);
    const json = serializeBackup(backup);

    // Wipe storage entirely — this is the "new device" scenario the feature exists for.
    localStorage.clear();
    expect(loadHousehold().children).toHaveLength(0);

    const parsed = parseBackup(json);
    expect(parsed).not.toBeNull();
    const restored = applyBackup(parsed!);

    expect(restored.pin).toBe('1234');
    expect(loadHousehold().children).toHaveLength(1);
    expect(loadChildSave(mayaId, 'Maya').stars).toBe(42);
  });

  it('rejects a hand-edited or foreign file instead of throwing', () => {
    expect(parseBackup('not json at all')).toBeNull();
    expect(parseBackup('{}')).toBeNull();
    expect(parseBackup(JSON.stringify({ version: 2, household: {}, children: {} }))).toBeNull();
    expect(parseBackup(JSON.stringify({ version: 1, household: { children: 'nope' }, children: {} }))).toBeNull();
  });

  it('a restore replaces the current household rather than merging with it', () => {
    const before = addChild(emptyHousehold(), 'Nia', 'c02');
    const nia = before.activeChildId!;

    const toBackUp = addChild(emptyHousehold(), 'Alex', 'c03');
    const backup = exportBackup(toBackUp);

    const restored = applyBackup(backup);
    expect(restored.children.map((c) => c.name)).toEqual(['Alex']);
    expect(restored.children.some((c) => c.id === nia)).toBe(false);
    // The pre-restore child's own save is untouched on disk...
    expect(loadChildSave(nia, 'Nia').stars).toBe(0);
    // ...it's simply no longer listed in the household that points to children.
    expect(loadHousehold().children.map((c) => c.name)).toEqual(['Alex']);
  });
});
