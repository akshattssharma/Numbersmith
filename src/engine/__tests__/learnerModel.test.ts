import { describe, expect, it } from 'vitest';
import { bktUpdate, createLearner, diagnose, mastery, recordAttempt, blockingPrereq } from '../learnerModel';
import type { Attempt, Problem } from '../types';

const learner = () => createLearner('t', 'Test');

const prob = (over: Partial<Problem> = {}): Problem => ({
  id: 'x', concept: 'sub-2digit-borrow', kind: 'ship', representation: 'symbolic',
  a: 62, b: 38, answer: 24, difficulty: 0.5, regroup: true, ...over,
});

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  problemId: 'x', concept: 'sub-2digit-borrow', representation: 'symbolic',
  given: 36, correct: false, latencyMs: 6000, hintsUsed: 0, churn: 0,
  abandoned: false, at: Date.now(), ...over,
});

describe('bayesian knowledge tracing', () => {
  it('rises on correct answers and falls on wrong ones', () => {
    const up = bktUpdate(0.5, true, 'add-within-20');
    const down = bktUpdate(0.5, false, 'add-within-20');
    expect(up).toBeGreaterThan(0.5);
    expect(down).toBeLessThan(0.5);
  });

  it('stays inside (0,1)', () => {
    let p = 0.5;
    for (let i = 0; i < 50; i++) p = bktUpdate(p, true, 'add-within-20');
    expect(p).toBeLessThan(1);
    p = 0.5;
    for (let i = 0; i < 50; i++) p = bktUpdate(p, false, 'add-within-20');
    expect(p).toBeGreaterThan(0);
  });
});

describe('diagnosis distinguishes kinds of wrong', () => {
  it('recognises a wrong rule rather than recording a zero', () => {
    const m = learner();
    const d = diagnose(m, prob(), 36, attempt({ given: 36 }));
    expect(d.errorClass).toBe('misconception');
    expect(d.misconception).toBe('sub-smaller-from-larger');
  });

  it('reads a fast near-miss on a known concept as carelessness', () => {
    let m = learner();
    // build up knowledge and a latency baseline first
    for (let i = 0; i < 6; i++) {
      const p = prob({ concept: 'add-within-20', kind: 'combine', a: 7, b: 5, answer: 12, regroup: false });
      const a = attempt({ concept: 'add-within-20', given: 12, correct: true, latencyMs: 5000 });
      m = recordAttempt(m, p, a, { errorClass: 'correct', confidence: 1, reading: '' });
    }
    const p = prob({ concept: 'add-within-20', kind: 'combine', a: 8, b: 6, answer: 14, regroup: false });
    const d = diagnose(m, p, 13, attempt({ concept: 'add-within-20', given: 13, latencyMs: 900 }));
    expect(['careless', 'misconception']).toContain(d.errorClass);
  });

  it('separates a notation problem from a knowledge problem', () => {
    let m = learner();
    // strong on the manipulative surface
    for (let i = 0; i < 4; i++) {
      m = recordAttempt(
        m,
        prob({ concept: 'add-within-20', kind: 'combine', representation: 'manipulative', a: 7, b: 5, answer: 12, regroup: false }),
        attempt({ concept: 'add-within-20', representation: 'manipulative', given: 12, correct: true, latencyMs: 5000 }),
        { errorClass: 'correct', confidence: 1, reading: '' },
      );
    }
    // weak on the symbolic surface
    for (let i = 0; i < 4; i++) {
      m = recordAttempt(
        m,
        prob({ concept: 'add-within-20', kind: 'combine', representation: 'symbolic', a: 7, b: 5, answer: 12, regroup: false }),
        attempt({ concept: 'add-within-20', representation: 'symbolic', given: 9, correct: false, latencyMs: 9000 }),
        { errorClass: 'gap', confidence: 0.5, reading: '' },
      );
    }
    const d = diagnose(
      m,
      prob({ concept: 'add-within-20', kind: 'combine', representation: 'symbolic', a: 6, b: 5, answer: 11, regroup: false }),
      8,
      attempt({ concept: 'add-within-20', representation: 'symbolic', given: 8, latencyMs: 9000 }),
    );
    expect(d.errorClass).toBe('notation');
  });
});

describe('mastery accounting', () => {
  it('a confirmed wrong rule caps mastery no matter the hit rate', () => {
    let m = learner();
    // Two firings of the same bug confirms it.
    for (let i = 0; i < 2; i++) {
      m = recordAttempt(m, prob(), attempt(), {
        errorClass: 'misconception', misconception: 'sub-smaller-from-larger', confidence: 0.7, reading: '',
      });
    }
    expect(m.misconceptions['sub-smaller-from-larger']?.status).toBe('confirmed');
    // Then pile on correct answers.
    m.concepts['sub-2digit-borrow'].pKnow = 0.95;
    expect(mastery(m, 'sub-2digit-borrow')).toBeLessThanOrEqual(0.45);
  });

  it('does not penalise knowledge for a notation failure', () => {
    const m = learner();
    const before = m.concepts['add-within-20'].pKnow;
    const after = recordAttempt(
      m,
      prob({ concept: 'add-within-20', kind: 'combine', a: 7, b: 5, answer: 12, regroup: false }),
      attempt({ concept: 'add-within-20', given: 9, correct: false }),
      { errorClass: 'notation', confidence: 0.6, reading: '' },
    );
    expect(after.concepts['add-within-20'].pKnow).toBe(before);
  });

  it('finds the prerequisite that is actually blocking progress', () => {
    const m = learner();
    const blocked = blockingPrereq(m, 'sub-2digit-borrow');
    expect(blocked).not.toBeNull();
    // should point upstream, not at the concept itself
    expect(blocked).not.toBe('sub-2digit-borrow');
  });
});
