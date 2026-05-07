// File: test-ai-forecast.js [TC 45 - AI Demand Forecast]
const AI_FORECAST_URL = "http://localhost:3011/api/ai/forecast";

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 45 - AI DEMAND FORECAST VALIDATION (Gemini Intelligence)");
    console.log("=".repeat(80));

    // Dữ liệu lịch sử 5 tiếng gần nhất
    const payload = {
        history: [
            { hour: "08:00", demand: 45 },
            { hour: "09:00", demand: 55 },
            { hour: "10:00", demand: 70 },
            { hour: "11:00", demand: 85 },
            { hour: "12:00", demand: 40 }
        ]
    };

    console.log("Input History:", JSON.stringify(payload.history, null, 2));
    console.log("\nAI is calculating future demand...");

    try {
        const response = await fetch(AI_FORECAST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.status === 200 && result.forecast) {
            console.log("\n[PASS] Forecast Received Successfully:");
            console.table(result.forecast);
            console.log(`Model: ${result.model}`);
            
            // Check schema
            const first = result.forecast[0];
            if (first.timestamp && typeof first.value === 'number') {
                console.log("\n[SUCCESS] Data schema is correct (timestamp + value).");
            }
        } else {
            console.log("\n[FAIL] Unexpected response:", result);
        }
    } catch (error) {
        console.error("\n[ERROR] Test failed:", error.message);
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
