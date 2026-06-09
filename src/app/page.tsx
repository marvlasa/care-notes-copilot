"use client";

import { useState } from "react";
import { AskForm } from "./components/AskForm";
import { AnswerCard } from "./components/AnswerCard";
import { Icon, SPARK, ARROW } from "./components/icons";

const EXAMPLE_QUESTIONS = [
  "What medications are prescribed for hypertension?",
  "What is the patient's most recent A1C level?",
  "What triggers asthma symptoms in this patient?",
  "What lifestyle changes are recommended for blood pressure?",
];

const FEATURES = [
  {
    label: "HIPAA Compliant",
    color: "chip-teal",
    paths: (
      <>
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
      </>
    ),
  },
  {
    label: "Streaming AI",
    color: "chip-emerald",
    paths: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  },
  {
    label: "Source-Grounded RAG",
    color: "chip-cyan",
    paths: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      </>
    ),
  },
  {
    label: "Zero Data Egress",
    color: "chip-teal",
    paths: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  },
];

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    if (!question.trim()) return;

    setAnswer("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setLoading(false);
    }
  }

  function selectExample(q: string) {
    setQuestion(q);
    setAnswer("");
    setError("");
  }

  const showExamples = !answer && !loading && !error;

  return (
    <div className="page">
      <header className="header">
        <div className="header-inner">
          <div className="wordmark">
            <div className="wordmark-icon tile" aria-hidden="true">
              <Icon strokeWidth={1.75}>{SPARK}</Icon>
            </div>
            <div className="wordmark-text">
              <span className="wordmark-title">CareNotes AI</span>
              <span className="wordmark-subtitle">Clinical Copilot</span>
            </div>
          </div>

          <div className="header-pill" aria-label="System status: online">
            <span className="header-pill-dot dot" aria-hidden="true" />
            <span className="header-pill-label">RAG · Live</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="shell">
          <section className="hero" aria-labelledby="hero-heading">
            <p className="hero-label eyebrow">Clinical Intelligence</p>
            <h1 className="hero-heading" id="hero-heading">
              Ask anything about<br />
              <em>your patient records</em>
            </h1>
            <p className="hero-body">
              Instant, AI-powered answers drawn from clinical notes —
              HIPAA-compliant, source-grounded, and streaming live.
            </p>
          </section>

          <div className="features" aria-label="Feature highlights">
            {FEATURES.map(({ label, color, paths }) => (
              <div className="feature-chip" key={label}>
                <Icon className={color}>{paths}</Icon>
                {label}
              </div>
            ))}
          </div>

          <AskForm
            value={question}
            loading={loading}
            onChange={setQuestion}
            onSubmit={ask}
          />

          {loading && !answer && (
            <div className="loading-card" role="status" aria-live="polite">
              <div className="loading-icon tile" aria-hidden="true">
                <Icon>{SPARK}</Icon>
              </div>
              <div className="loading-text-block">
                <p>Searching clinical notes&hellip;</p>
                <span>Retrieving context &amp; generating response</span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-card" role="alert">
              <Icon>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </Icon>
              <div className="error-card-content">
                <p>Request failed</p>
                <span>{error}</span>
              </div>
            </div>
          )}

          {answer && <AnswerCard answer={answer} streaming={loading} />}

          {showExamples && (
            <section className="examples-section" aria-labelledby="examples-label">
              <p className="section-label eyebrow" id="examples-label">Try asking</p>
              <div className="examples-grid">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="example-btn"
                    onClick={() => selectExample(q)}
                    aria-label={`Ask: ${q}`}
                  >
                    <span className="example-btn-arrow tile" aria-hidden="true">
                      <Icon strokeWidth={2.5}>{ARROW}</Icon>
                    </span>
                    <span className="example-btn-text">{q}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>
          <span>CareNotes Copilot</span>
          {" · "}Powered by Retrieval-Augmented Generation
          {" · "}Local inference, zero API costs
        </p>
      </footer>
    </div>
  );
}
