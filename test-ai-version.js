// File: test-ai-version.js [TC 46 - FIXED]
const BASE_URL = "http://localhost:3011/api/ai";

async function checkVersion(endpoint, method = 'POST', body = {}) {
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (method === 'POST') options.body = JSON.stringify(body);

        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await res.json();
        
        if (res.status !== 200) {
            return `HTTP ${res.status}: ${data.error || 'Unknown Error'}`;
        }
        
        return data.model || 'N/A';
    } catch (e) {
        return `FETCH_ERROR: ${e.message}`;
    }
}

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 46 - MODEL VERSION METADATA VALIDATION (Fixed)");
    console.log("=".repeat(80));

    const testCases = [
        { name: "ETA Service", path: "/eta", body: { distance: 5 } },
        { name: "Fraud Service", path: "/fraud", body: { amount: 100 } },
        // Gửi history mẫu để tránh lỗi AI reasoning
        { name: "Forecast Service", path: "/forecast", body: { history: [{hour: "10:00", demand: 50}] } },
        { name: "Recommend Service", path: "/recommend-drivers", body: { drivers: [{id:'D1', distance:1, rating:5}] } }
    ];

    console.log("Checking model version consistency across endpoints...\n");

    const results = [];
    for (const tc of testCases) {
        const version = await checkVersion(tc.path, 'POST', tc.body);
        const isCorrect = version === 'gemini-2.5-flash-lite';
        
        results.push({
            'Endpoint': tc.name,
            'Path': tc.path,
            'Model Version': version,
            'Status': isCorrect ? '✅ PASS' : '❌ FAIL'
        });
    }

    console.table(results);

    const allPass = results.every(r => r.Status === '✅ PASS');
    if (allPass) {
        console.log("\n[FINAL RESULT] PASS: All services are correctly reporting 'gemini-2.5-flash-lite'.");
    } else {
        console.log("\n[FINAL RESULT] FAIL: Some services failed or have incorrect version metadata.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
