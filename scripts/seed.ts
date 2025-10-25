import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { pool } from "@/db";
import { openai, isUsingOllama } from "@/ai/openai";

async function embed(text: string): Promise<number[]> {
  if (isUsingOllama) {
    // Ollama doesn't support embeddings API, use nomic-embed-text model
    const response = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    const data = await response.json();
    // Ollama returns embeddings as array, ensure it's numbers
    const embedding = data.embedding;
    return Array.isArray(embedding) ? embedding.map((v: any) => Number(v)) : embedding;
  }
  
  const res = await (openai as OpenAI).embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

function chunk(text: string, maxChars = 800) {
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + maxChars));
    i += maxChars;
  }
  return parts;
}

async function main() {
  const dir = path.join(process.cwd(), "data/notes");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const title = file.replace(".md", "");
    const { rows: docRows } = await pool.query(
      "INSERT INTO documents (title, source) VALUES ($1,$2) RETURNING id",
      [title, "seed"]
    );
    const docId = docRows[0].id;
    for (const part of chunk(content)) {
      const emb = await embed(part);
      // Format embedding for pgvector: convert array to [1,2,3] format
      const embStr = `[${emb.join(',')}]`;
      await pool.query(
        "INSERT INTO chunks (document_id, content, embedding) VALUES ($1,$2,$3::vector)",
        [docId, part, embStr]
      );
    }
    console.log(`Seeded ${file}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
