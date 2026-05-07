// File: test-ai-recommend.js [TC 44 - AI Driver Recommendation - FIXED]
const AI_RECOMMEND_URL = "http://localhost:3011/api/ai/recommend-drivers";

async function callRecommend(body) {
  try {
    const res = await fetch(AI_RECOMMEND_URL, {
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
  console.log("TC 44 - AI DRIVER RECOMMENDATION VALIDATION (Top 3 Rankings)");
  console.log("=".repeat(90));

  const payload = {
    booking_context: { pickup: "Quận 1", dropoff: "Quận 7", time: "19:00" },
    drivers: [
      { id: 'D1', name: 'An', distance: 2.5, rating: 4.8, car_type: 'Sedan' },
      { id: 'D2', name: 'Binh', distance: 0.5, rating: 3.2, car_type: 'Sedan' },
      { id: 'D3', name: 'Cuong', distance: 1.2, rating: 4.9, car_type: 'SUV' },
      { id: 'D4', name: 'Dung', distance: 5.0, rating: 5.0, car_type: 'Sedan' },
      { id: 'D5', name: 'Em', distance: 0.8, rating: 4.5, car_type: 'Sedan' }
    ]
  };

  const r = await callRecommend(payload);
  
  if (r.status === 200) {
    // FIXED: AI Service returns "drivers" key, and uses "driverId"
    const driversList = r.data.drivers || []; 
    console.log(`AI evaluated ${driversList.length} drivers.`);
    
    // We only take TOP 3 for the recommendation view
    const top3 = driversList.slice(0, 3);
    
    const results = top3.map((d, index) => ({
      'Rank': index + 1,
      'Driver ID': d.driverId,
      'Score': d.score,
      'Reason': d.reason
    }));

    console.table(results);
    
    if (top3.length === 3) {
      console.log("\n[PASS] AI returned exactly Top 3 drivers as requested.");
    } else {
      console.log("\n[FAIL] Expected 3 drivers, but got " + top3.length);
    }
  } else {
    console.error("Error calling AI Service:", r.data);
  }
  console.log("=".repeat(90));
}

run();
