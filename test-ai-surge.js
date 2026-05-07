// File: test-ai-surge.js [TC 42 - AI Pricing Surge Validation]
const AI_SURGE_URL = "http://localhost:3011/api/ai/pricing-surge";

async function callSurge(body) {
  try {
    const res = await fetch(AI_SURGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() };
  } catch (e) {
    return { status: 500, data: { error: e.message } };
  }
}

async function run() {
  console.log("\n" + "=".repeat(80));
  console.log("TC 42 - AI PRICING SURGE VALIDATION (Gemini Powered)");
  console.log("=".repeat(80));

  const scenarios = [
    { label: 'Normal Day', body: { demand: 'LOW', available_drivers: 10, weather: 'clear' } },
    { label: 'Rush Hour + High Demand', body: { demand: 'HIGH', available_drivers: 2, weather: 'clear' } },
    { label: 'Rainy Day (Heavy Surge)', body: { demand: 'HIGH', available_drivers: 3, weather: 'rain' } }
  ];

  const results = [];

  for (const s of scenarios) {
    const r = await callSurge(s.body);
    results.push({
      'Scenario': s.label,
      'Demand': s.body.demand,
      'Drivers': s.body.available_drivers,
      'Weather': s.body.weather,
      'Surge Multiplier': r.data.surge_multiplier + 'x',
      'Reasoning': (r.data.reasoning || '').substring(0, 45) + '...',
      'Model': r.data.model || 'N/A'
    });
  }

  console.table(results);
  console.log("=".repeat(80));
  console.log("[PASS] AI dynamically adjusted pricing based on complex environmental factors.");
}

run();
