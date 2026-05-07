// File: test-ai-eta.js [TC 41 - AI Service ETA Validation]
// Version: 3.1.0 (Real AI Reasoning Support)

const AI_ETA_URL = "http://localhost:3011/api/ai/eta";

async function callETA(body) {
  try {
    const res = await fetch(AI_ETA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() };
  } catch (e) {
    return { status: 500, data: { error: e.message } };
  }
}

function title(t) { console.log(`\n${'='.repeat(80)}\n${t}\n${'='.repeat(80)}`); }
function pass(msg) { console.log(`  [PASS] ${msg}`); }
function fail(msg) { console.log(`  [FAIL] ${msg}`); }

async function run() {
  title('TC 41 - AI SERVICE VALIDATION (Gemini 2.5 Flash Powered)');

  const results = [];

  const testCases = [
    { label: 'Normal (5km)', body: { distance_km: 5 } },
    { label: 'At Destination (0km)', body: { distance_km: 0 } },
    { label: 'Long Trip (20km)', body: { distance_km: 20 } },
    { label: 'Heavy Traffic (5km, 0.9)', body: { distance_km: 5, traffic_level: 0.9 } },
    { label: 'Invalid Input (-5km)', body: { distance_km: -5 } }
  ];

  for (const tc of testCases) {
    const r = await callETA(tc.body);
    let ok = false;
    let etaVal = r.data.eta;

    if (tc.body.distance_km === 0) ok = etaVal === 0;
    else if (tc.body.distance_km < 0) ok = r.status === 422;
    else ok = (typeof etaVal === 'number' && etaVal > 0);

    results.push({
      'Scenario': tc.label,
      'HTTP': r.status,
      'ETA': etaVal ?? 'N/A',
      'Model': r.data.model || 'N/A',
      'Reasoning': (r.data.reasoning || '').substring(0, 50) + '...',
      'Pass?': ok ? 'YES' : 'NO'
    });

    if (ok) pass(`${tc.label} -> Result: ${etaVal} mins`);
    else fail(`${tc.label} failed!`);
  }

  title('FINAL TEST REPORT (REAL-TIME AI INFERENCE)');
  console.table(results);

  console.log('\n[INFO] AI Service is using Gemini 2.5 Flash Lite for real-time reasoning.');
  console.log('='.repeat(80));
}

run();
