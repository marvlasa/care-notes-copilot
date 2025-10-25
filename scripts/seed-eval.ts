import { pool } from "@/db";

/**
 * Seed evaluation dataset with test cases
 */
async function main() {
  // Create evaluation dataset
  const { rows: datasetRows } = await pool.query(
    `INSERT INTO eval_datasets (name, description) 
     VALUES ($1, $2) 
     ON CONFLICT (name) DO UPDATE SET description = $2
     RETURNING id`,
    [
      "clinical-qa-v1",
      "Basic clinical question answering test cases for hypertension, diabetes, and asthma notes",
    ]
  );
  const datasetId = datasetRows[0].id;

  // Define test cases
  const cases = [
    {
      question: "What medication is prescribed for hypertension?",
      expected: "Lisinopril 20mg daily",
      contexts: ["hypertension"],
    },
    {
      question: "What side effect is the patient experiencing from Lisinopril?",
      expected: "mild dry cough",
      contexts: ["hypertension"],
    },
    {
      question: "What is the patient's current A1C level?",
      expected: "8.2%",
      contexts: ["diabetes"],
    },
    {
      question: "What diabetes medication is the patient taking?",
      expected: "Metformin 1000mg BID",
      contexts: ["diabetes"],
    },
    {
      question: "What should be added if the Lisinopril cough persists?",
      expected: "HCTZ 12.5mg",
      contexts: ["hypertension"],
    },
    {
      question: "How many times per day is the patient using their Albuterol inhaler?",
      expected: "3-4 times per day",
      contexts: ["asthma"],
    },
    {
      question: "What is the maintenance medication for asthma?",
      expected: "Fluticasone 110mcg BID",
      contexts: ["asthma"],
    },
    {
      question: "What medication adjustment is recommended for diabetes if there's no improvement?",
      expected: "add GLP-1 agonist",
      contexts: ["diabetes"],
    },
    {
      question: "What dietary changes are recommended for hypertension?",
      expected: "DASH diet, reduce salt intake",
      contexts: ["hypertension"],
    },
    {
      question: "What is causing the asthma flare?",
      expected: "seasonal allergies",
      contexts: ["asthma"],
    },
  ];

  for (const testCase of cases) {
    await pool.query(
      `INSERT INTO eval_cases (dataset_id, question, expected_answer, expected_contexts, metadata) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [
        datasetId,
        testCase.question,
        testCase.expected,
        testCase.contexts,
        JSON.stringify({ category: "medical_query" }),
      ]
    );
  }

  console.log(`✓ Seeded ${cases.length} evaluation cases`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

