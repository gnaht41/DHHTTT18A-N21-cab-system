// test-performance-kafka.js — TC 64: LEVEL 7 - PERFORMANCE & LOAD TEST (KAFKA)
// Kịch bản: Bắn hàng nghìn event vào Kafka (topic: RideRequested)
// Kiểm tra Producer throughput và Consumer lag, Queue có ổn định và không mất event không.

const { Kafka } = require('./services/booking-service/node_modules/kafkajs');

const kafka = new Kafka({
    clientId: 'test-performance-client',
    brokers: ['localhost:29092']
});

const producer = kafka.producer();
// Dùng một group id ngẫu nhiên để nhận toàn bộ message (mỗi group có offset riêng)
const consumer = kafka.consumer({ groupId: `test-throughput-group-${Date.now()}` });

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 64 - LEVEL 7 PERFORMANCE & LOAD TEST (KAFKA THROUGHPUT)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Bắn 5000 event (ride_requested) vào Kafka nhanh nhất có thể.");
    console.log("Kỳ vọng: Không mất event, Consumer tiêu thụ nhanh, Queue ổn định.\n");

    const TOPIC = 'RideRequested';
    const NUM_EVENTS = 5000;
    
    let consumedCount = 0;
    let consumeStartTime = null;
    let consumeEndTime = null;

    try {
        console.log("[1] Kết nối Producer và Consumer...");
        await producer.connect();
        await consumer.connect();

        await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

        // Tạo Promise chờ consumer join xong group
        const consumerJoined = new Promise((resolve) => {
            consumer.on(consumer.events.GROUP_JOIN, () => {
                console.log("[2] Consumer đã join group thành công!");
                resolve();
            });
        });

        // Bắt đầu lắng nghe
        consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                if (!consumeStartTime) consumeStartTime = Date.now();
                
                const val = message.value.toString();
                if (val.includes("TEST_LOAD")) {
                    consumedCount++;
                    if (consumedCount === NUM_EVENTS) {
                        consumeEndTime = Date.now();
                    }
                }
            },
        });

        console.log("[2] Chờ Consumer rebalance...");
        await consumerJoined;
        // Đợi thêm 1s cho chắc chắn offset được commit
        await new Promise(r => setTimeout(r, 1000));

        console.log(`[3] Bắt đầu bắn ${NUM_EVENTS} events vào topic ${TOPIC}...`);
        const produceStart = Date.now();

        // Gửi theo batch để đạt throughput tối đa
        const BATCH_SIZE = 500;
        let producedCount = 0;

        for (let i = 0; i < NUM_EVENTS; i += BATCH_SIZE) {
            const messages = [];
            for (let j = 0; j < BATCH_SIZE && (i + j) < NUM_EVENTS; j++) {
                messages.push({
                    value: JSON.stringify({ 
                        type: 'TEST_LOAD', 
                        id: i + j, 
                        timestamp: Date.now() 
                    })
                });
            }
            await producer.send({
                topic: TOPIC,
                messages: messages
            });
            producedCount += messages.length;
            process.stdout.write(`\rĐã gửi: ${producedCount}/${NUM_EVENTS}`);
        }
        
        const produceEnd = Date.now();
        console.log(`\n\n[INFO] Đã gửi xong ${NUM_EVENTS} events trong ${produceEnd - produceStart}ms.`);
        console.log(`[INFO] Producer Throughput: ${Math.round((NUM_EVENTS / (produceEnd - produceStart)) * 1000)} events/sec`);

        console.log("\n[4] Chờ Consumer xử lý...");
        
        // Timeout chờ đợi tối đa 10s
        let waitTime = 0;
        while (consumedCount < NUM_EVENTS && waitTime < 10000) {
            await new Promise(r => setTimeout(r, 100));
            waitTime += 100;
            process.stdout.write(`\rĐang tiêu thụ: ${consumedCount}/${NUM_EVENTS}`);
        }

        console.log(`\n\n--- Báo Cáo Kafka Throughput ---`);
        console.log(`Events Đã Gửi:     ${producedCount}`);
        console.log(`Events Đã Nhận:    ${consumedCount}`);
        
        const isLost = consumedCount < NUM_EVENTS;
        console.log(`Mất Event:         ${isLost ? 'CÓ (❌)' : 'KHÔNG (✅)'}`);

        if (consumeEndTime && consumeStartTime) {
            const consumeDuration = consumeEndTime - consumeStartTime;
            console.log(`Thời gian Consumer chạy: ${consumeDuration}ms`);
            console.log(`Consumer Throughput:     ${Math.round((NUM_EVENTS / consumeDuration) * 1000)} events/sec`);
            
            const lag = consumeEndTime - produceEnd;
            console.log(`Consumer Lag (Độ trễ sau khi gửi xong): ${Math.max(0, lag)}ms`);
        } else {
            console.log(`Consumer Lag:     TIMEOUT (Quá tải)`);
        }

        console.log("\n" + "=".repeat(80));
        if (!isLost && consumedCount === NUM_EVENTS) {
            console.log("✅ KẾT QUẢ: ĐẠT (PASS) - Hàng nghìn events/sec được Kafka xử lý trơn tru.");
        } else {
            console.log("❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Bị mất event hoặc Consumer quá lag.");
        }
        console.log("=".repeat(80) + "\n");

    } catch (err) {
        console.error("Lỗi quá trình test:", err);
    } finally {
        await producer.disconnect();
        await consumer.disconnect();
        process.exit(0);
    }
}

runTest();
