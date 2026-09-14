import type { LearnerModel } from './types';
import { createLearner } from './learnerModel';
import { defaultProfile, normaliseName, type PersonalProfile } from './cast';
import type { QuestState } from './quest';
import { initStruggle, type StruggleState } from './struggle';

/**
 * The household — one device, one or more children, one grown-up gate.
 *
 * This is a static site with no server and no accounts, so "login" cannot mean
 * what it means for a bank. What it can mean, honestly: a short local PIN that
 * keeps a child from casually wandering into the parent tools, and a clean
 * separation between what a child's screen shows and what a grown-up's does.
 * Nothing here is sent anywhere — the PIN, the children, their names and their
 * whole progress history live in this browser's storage and nowhere else.
 */

export interface ChildMeta {
  id: string;
  /** first name only — same rule as the cast, enforced the same way */
  name: string;
  characterId: string;
  createdAt: number;
}

export interface Household {
  /** 4-digit local PIN. Not security — a speed bump. See ParentGate. */
  pin: string | null;
  children: ChildMeta[];
  activeChildId: string | null;
}

export interface ChildSave {
  model: LearnerModel;
  struggle: StruggleState;
  profile: PersonalProfile;
  index: number;
  /** the quest in flight when this child was last saved */
  quest: QuestState | null;
  questNumber: number;
  /** true if their last sitting reached its own natural end — read on the
   *  next load to start a fresh sitting rather than resuming a finished one */
  sittingEnded: boolean;
}

const HH_KEY = 'numbersmith.household.v1';
const LEGACY_PROFILE_KEY = 'numbersmith.profile.v1';
const childKey = (id: string) => `numbersmith.child.${id}.v1`;

export function emptyHousehold(): Household {
  return { pin: null, children: [], activeChildId: null };
}

/**
 * Load the household, migrating in one direction only: a first run that finds
 * an old single-child profile (from before multiple children existed) adopts
 * it as the first child rather than discarding it. A parent who has already
 * spent five minutes building a cast should never see that work vanish under
 * an update.
 */
export function loadHousehold(): Household {
  try {
    const raw = localStorage.getItem(HH_KEY);
    if (raw) return { ...emptyHousehold(), ...JSON.parse(raw) };
  } catch {
    /* fall through to a fresh household */
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (legacyRaw) {
      const profile = JSON.parse(legacyRaw) as PersonalProfile;
      const name = normaliseName(profile.childName ?? '') || 'Player';
      const id = `c_${Date.now().toString(36)}`;
      const meta: ChildMeta = { id, name, characterId: 'c00', createdAt: Date.now() };
      saveChildSave(id, {
        model: createLearner(id, name), struggle: initStruggle(), profile, index: 0,
        quest: null, questNumber: 0, sittingEnded: false,
      });
      const h: Household = { pin: null, children: [meta], activeChildId: id };
      saveHousehold(h);
      return h;
    }
  } catch {
    /* ignore and fall through */
  }

  return emptyHousehold();
}

export function saveHousehold(h: Household): void {
  try {
    localStorage.setItem(HH_KEY, JSON.stringify(h));
  } catch {
    /* best-effort — nothing to tell a child about */
  }
}

export function newChildSave(id: string, name: string): ChildSave {
  return {
    model: createLearner(id, name || 'Player'),
    struggle: initStruggle(),
    profile: defaultProfile(),
    index: 0,
    quest: null,
    questNumber: 0,
    sittingEnded: false,
  };
}

/** Old saves predate the quest layer — default the fields they never had. */
function withQuestDefaults(raw: Partial<ChildSave>, fallback: ChildSave): ChildSave {
  return {
    model: raw.model ?? fallback.model,
    struggle: raw.struggle ?? fallback.struggle,
    profile: raw.profile ?? fallback.profile,
    index: raw.index ?? fallback.index,
    quest: raw.quest ?? null,
    questNumber: raw.questNumber ?? 0,
    sittingEnded: raw.sittingEnded ?? false,
  };
}

export function loadChildSave(id: string, name: string): ChildSave {
  try {
    const raw = localStorage.getItem(childKey(id));
    if (raw) return withQuestDefaults(JSON.parse(raw), newChildSave(id, name));
  } catch {
    /* fall through to a fresh save */
  }
  return newChildSave(id, name);
}

export function saveChildSave(id: string, save: ChildSave): void {
  try {
    localStorage.setItem(childKey(id), JSON.stringify(save));
  } catch {
    /* best-effort */
  }
}

export function deleteChildSave(id: string): void {
  try {
    localStorage.removeItem(childKey(id));
  } catch {
    /* best-effort */
  }
}

export function addChild(h: Household, name: string, characterId: string): Household {
  const clean = normaliseName(name) || 'Player';
  const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const meta: ChildMeta = { id, name: clean, characterId, createdAt: Date.now() };
  saveChildSave(id, newChildSave(id, clean));
  return { ...h, children: [...h.children, meta], activeChildId: h.activeChildId ?? id };
}

export function removeChild(h: Household, id: string): Household {
  deleteChildSave(id);
  const children = h.children.filter((c) => c.id !== id);
  const activeChildId = h.activeChildId === id ? (children[0]?.id ?? null) : h.activeChildId;
  return { ...h, children, activeChildId };
}

export function switchActiveChild(h: Household, id: string): Household {
  return h.children.some((c) => c.id === id) ? { ...h, activeChildId: id } : h;
}

export function setPin(h: Household, pin: string): Household {
  return { ...h, pin };
}

export function checkPin(h: Household, guess: string): boolean {
  return !!h.pin && h.pin === guess;
}
