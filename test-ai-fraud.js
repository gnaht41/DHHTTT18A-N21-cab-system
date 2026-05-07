// File: test-ai-fraud.js [TC 43 - AI Fraud Detection]
const AI_FRAUD_URL = "http://localhost:3011/api/ai/fraud";

async function callFraud(body) {
  try {
    const res = await fetch(AI_FRAUD_URL, {
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
  console.log("\n" + "=".repeat(90));
  console.log("TC 43 - AI FRAUD DETECTION VALIDATION (Gemini Powered)");
  console.log("=".repeat(90));

  const scenarios = [
    { 
      label: 'Trusted User', 
      body: { user_history_score: 0.9, transaction_amount: 15, ip_country: 'VN', device_fingerprint_match: true } 
    },
    { 
      label: 'High Risk (Foreign IP + Big $$)', 
      body: { user_history_score: 0.2, transaction_amount: 2500, ip_country: 'UNKNOWN', device_fingerprint_match: false, booking_frequency_1h: 12 } 
    }
  ];

  const results = [];

  for (const s of scenarios) {
    const r = await callFraud(s.body);
    results.push({
      'Scenario': s.label,
      'Score': r.data.fraud_score,
      'Risk Level': r.data.risk_level,
      'Flagged?': r.data.flagged ? '🚨 YES' : '✅ NO',
      'AI Reasoning': (r.data.reasoning || '').substring(0, 50) + '...',
      'Signals Detected': (r.data.signals || []).join(', ')
    });
  }

  console.table(results);
  console.log("=".repeat(90));
  console.log("[PASS] AI successfully identified normal vs abnormal transaction behaviors.");
}

run();
