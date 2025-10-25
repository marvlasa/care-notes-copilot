#!/usr/bin/env tsx
// @ts-ignore
import autocannon from "autocannon";

/**
 * Load test the /api/ask endpoint
 * 
 * Usage:
 *   npm run test:load
 *   tsx scripts/load-test.ts -- --duration 30 --connections 10
 */

const queries = [
  "What medication is prescribed for hypertension?",
  "What is the patient's A1C level?",
  "What should be added if the cough persists?",
  "How often is the Albuterol inhaler being used?",
  "What dietary changes are recommended?",
];

async function runLoadTest() {
  const url = process.env.TEST_URL || "http://localhost:3000";
  const duration = parseInt(process.argv[3] || "10", 10);
  const connections = parseInt(process.argv[5] || "5", 10);

  console.log(`\n🚀 Load Testing ${url}/api/ask`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Connections: ${connections}\n`);

  const result = await autocannon({
    url: `${url}/api/ask`,
    connections,
    duration,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    } as Record<string, string>,
    setupClient: (client: any) => {
      client.on("response", (statusCode: number, resBytes: number, responseTime: number) => {
        if (statusCode !== 200) {
          console.error(`   ❌ Error: Status ${statusCode}`);
        }
      });
    },
    requests: queries.map((question) => ({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        sessionId: "load-test",
      }),
    })),
  });

  console.log(`\n📊 Results:`);
  console.log(`   Requests: ${result.requests.total}`);
  console.log(`   Throughput: ${result.throughput.mean.toFixed(2)} req/sec`);
  console.log(`   Latency:`);
  console.log(`     Mean: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`     p50: ${result.latency.p50}ms`);
  console.log(`     p95: ${result.latency.p95}ms`);
  console.log(`     p99: ${result.latency.p99}ms`);
  console.log(`   Errors: ${result.errors}`);
  console.log(`   Timeouts: ${result.timeouts}\n`);

  // Performance thresholds
  const failed = [];
  if (result.latency.p95 > 5000) {
    failed.push(`p95 latency too high: ${result.latency.p95}ms > 5000ms`);
  }
  if (result.errors > result.requests.total * 0.01) {
    failed.push(`Error rate too high: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
  }

  if (failed.length > 0) {
    console.error("❌ Performance thresholds FAILED:");
    failed.forEach((f) => console.error(`   - ${f}`));
    process.exit(1);
  } else {
    console.log("✅ All performance thresholds passed!\n");
  }
}

runLoadTest().catch((e) => {
  console.error(e);
  process.exit(1);
});

