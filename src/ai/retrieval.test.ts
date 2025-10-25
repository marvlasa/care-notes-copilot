import { describe, it, expect, beforeAll } from "vitest";
import { retrieveTopK, embedQuery } from "./retrieval";
import { pool } from "@/db";

describe("Retrieval System", () => {
  beforeAll(async () => {
    // Ensure database is seeded
    const { rows } = await pool.query("SELECT COUNT(*) FROM chunks");
    const count = parseInt(rows[0].count);
    if (count === 0) {
      console.warn("⚠️  Database not seeded. Run: npm run db:seed");
    }
  });

  describe("embedQuery", () => {
    it("should generate embedding vector", async () => {
      const embedding = await embedQuery("hypertension medication");
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536); // text-embedding-3-small
      expect(typeof embedding[0]).toBe("number");
    }, 30000);

    it("should return cached embedding on second call", async () => {
      const query = "diabetes treatment plan";
      
      const start1 = Date.now();
      const emb1 = await embedQuery(query);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const emb2 = await embedQuery(query);
      const time2 = Date.now() - start2;

      expect(emb1).toEqual(emb2);
      expect(time2).toBeLessThan(time1 / 2); // Cache should be much faster
    }, 30000);
  });

  describe("retrieveTopK", () => {
    it("should retrieve relevant chunks for medical query", async () => {
      const results = await retrieveTopK("blood pressure medication side effects", 3);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      
      // Check result structure
      expect(results[0]).toHaveProperty("content");
      expect(results[0]).toHaveProperty("similarity");
      expect(typeof results[0].similarity).toBe("number");
      expect(results[0].similarity).toBeGreaterThanOrEqual(0);
      expect(results[0].similarity).toBeLessThanOrEqual(1);

      // Results should be sorted by similarity (descending)
      if (results.length > 1) {
        expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      }
    }, 30000);

    it("should retrieve different results for different queries", async () => {
      const results1 = await retrieveTopK("hypertension treatment", 2);
      const results2 = await retrieveTopK("diabetes management", 2);

      expect(results1[0].content).not.toBe(results2[0].content);
    }, 30000);

    it("should respect k parameter", async () => {
      const k = 5;
      const results = await retrieveTopK("asthma medication", k);
      
      expect(results.length).toBeLessThanOrEqual(k);
    }, 30000);

    it("should work with hybrid search enabled", async () => {
      const results = await retrieveTopK("Lisinopril cough", 3, {
        useHybrid: true,
        useRerank: false,
        useCache: false,
      });

      expect(results.length).toBeGreaterThan(0);
      // Should find hypertension note mentioning Lisinopril and cough
      const relevant = results.some((r) =>
        r.content.toLowerCase().includes("lisinopril") ||
        r.content.toLowerCase().includes("cough")
      );
      expect(relevant).toBe(true);
    }, 30000);

    it("should cache retrieval results", async () => {
      const query = "asthma inhaler frequency";
      
      const start1 = Date.now();
      const results1 = await retrieveTopK(query, 3, { useCache: true });
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const results2 = await retrieveTopK(query, 3, { useCache: true });
      const time2 = Date.now() - start2;

      expect(results1).toEqual(results2);
      expect(time2).toBeLessThan(time1 / 2);
    }, 30000);
  });
});
