/**
 * Print the divergence report to a terminal. Useful in CI logs and for pasting
 * the headline numbers into a write-up without opening the app.
 *
 *   npm run sim
 */
import { divergenceReport, runAllJourneys } from '../src/engine/simulate';
import { MISCONCEPTIONS } from '../src/engine/misconceptions';

const turns = Number(process.argv[2] ?? 30);
const journeys = runAllJourneys(turns);
const report = divergenceReport(journeys);

console.log(`\nFive children, ${turns} items each, identical opening.\n`);

for (const j of journeys) {
  const s = j.summary;
  const bugs = s.misconceptionsFound
    .filter((b) => b.status !== 'suspected')
    .map((b) => MISCONCEPTIONS[b.id].label);
  console.log(
    `${j.persona.name.padEnd(7)} world=${s.world.padEnd(9)} tone=${s.tone.padEnd(11)} ` +
    `surface=${Object.entries(s.representationMix).sort((a, b) => b[1] - a[1])[0][0].padEnd(13)} ` +
    `diff=${s.meanDifficulty.toFixed(2)} acc=${(s.accuracy * 100).toFixed(0)}% ` +
    `depth=${s.frontierDepth} timer=${s.timePressure ? 'on' : 'off'}`,
  );
  if (bugs.length) console.log(`${''.padEnd(8)}found: ${bugs.join('; ')}`);
  if (s.interventions.length) console.log(`${''.padEnd(8)}tried: ${s.interventions.join(', ')}`);
}

console.log(`\nPairwise divergence across 10 personalization dimensions:`);
for (const p of report.pairs) console.log(`  ${p.a} / ${p.b}: ${p.differing}`);
console.log(`\n  minimum ${report.minPairDifference}   mean ${report.meanPairDifference.toFixed(2)}\n`);
