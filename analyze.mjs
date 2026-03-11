import topo from './data/geo/coastal-waters.topo.json' assert { type: 'json' };
import { feature } from 'topojson-client';
import data from './data/dashboard-data.json' assert { type: 'json' };
import lookup from './data/name-lookup.json' assert { type: 'json' };

const objectKey = Object.keys(topo.objects)[0];
const geoJson = feature(topo, topo.objects[objectKey]);
const plans = data.plans || [];

// Build a set of plan names for quick lookup
const planNames = new Set(plans.map(p => p.name));

// Check each feature against plans
const results = geoJson.features.map(f => {
  const opNavn = f.properties?.op_navn || 'MISSING';
  const marsName = lookup[opNavn] || opNavn;
  const found = planNames.has(marsName);
  return {
    opNavn,
    marsName,
    found
  };
}).sort((a, b) => a.opNavn.localeCompare(b.opNavn));

const matched = results.filter(r => r.found);
const unmatched = results.filter(r => !r.found);

console.log('=== MATCHING SUMMARY ===');
console.log('Total coastal features:', geoJson.features.length);
console.log('Total plans:', plans.length);
console.log('Matched features:', matched.length);
console.log('Unmatched features:', unmatched.length);
console.log('Match rate:', ((matched.length / geoJson.features.length) * 100).toFixed(1) + '%');

console.log('\n=== UNMATCHED FEATURES (' + unmatched.length + ') ===');
unmatched.forEach(r => {
  console.log(' - ' + r.opNavn + ' (lookup -> ' + r.marsName + ')');
});

console.log('\n=== PLANS WITH NO MATCHING FEATURES ===');
const featuresSet = new Set(results.map(r => r.marsName));
const orphanPlans = plans.filter(p => !featuresSet.has(p.name)).map(p => p.name).sort();
console.log('Count:', orphanPlans.length);
orphanPlans.forEach(name => {
  console.log(' - ' + name);
});
