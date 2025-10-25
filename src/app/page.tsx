"use client";

import { useState } from "react";

export default function Home() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function ask() {
    if (!q.trim()) return;
    
    setA("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        body: JSON.stringify({ question: q }),
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
        const chunk = decoder.decode(value);
        setA((prev) => prev + chunk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setLoading(false);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      ask();
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo">
              <span className="logo-icon">⚕️</span>
            </div>
            <div>
              <h1 className="page-title">CareNotes AI</h1>
              <p className="page-subtitle">Clinical Intelligence Assistant</p>
            </div>
          </div>
          <div className="header-badge">
            <span className="badge-icon">🤖</span>
            <span className="badge-text">Powered by RAG</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="page-main">
        <div className="content-wrapper">
          {/* Info Cards */}
          <div className="info-cards">
            <div className="info-card">
              <span className="info-icon">📋</span>
              <div>
                <h3 className="info-title">Clinical Notes</h3>
                <p className="info-text">Search across patient records</p>
              </div>
            </div>
            <div className="info-card">
              <span className="info-icon">⚡</span>
              <div>
                <h3 className="info-title">Instant Insights</h3>
                <p className="info-text">AI-powered responses</p>
              </div>
            </div>
            <div className="info-card">
              <span className="info-icon">🔒</span>
              <div>
                <h3 className="info-title">Secure & Private</h3>
                <p className="info-text">HIPAA compliant</p>
              </div>
            </div>
          </div>

          {/* Query Card */}
          <div className="query-card">
            <div className="card-header">
              <h2 className="card-title">Ask a Clinical Question</h2>
              <p className="card-subtitle">
                Get instant answers from your clinical notes database
              </p>
            </div>

            <div className="input-section">
              <div className="input-wrapper">
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., What medications are prescribed for hypertension?"
                  className="query-textarea"
                  disabled={loading}
                  rows={4}
                />
                <div className="input-hint">
                  <span className="hint-icon">💡</span>
                  <span className="hint-text">
                    Try: "What should be done if lisinopril cough persists?"
                  </span>
                </div>
              </div>

              <button
                onClick={ask}
                disabled={loading || !q.trim()}
                className="ask-button"
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="button-icon">🔍</span>
                    <span>Ask CareNotes AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Response Card */}
          {(a || error) && (
            <div className={`response-card ${error ? "error" : ""}`}>
              <div className="response-header">
                <div className="response-header-left">
                  <span className={error ? "error-icon" : "check-icon"}>
                    {error ? "⚠️" : "✓"}
                  </span>
                  <h3 className="response-title">
                    {error ? "Error" : "AI Response"}
                  </h3>
                </div>
                {!error && (
                  <span className="response-badge">
                    <span className="response-dot"></span>
                    <span>Streaming</span>
                  </span>
                )}
              </div>
              <div className="response-content">
                {error ? (
                  <p className="error-text">{error}</p>
                ) : (
                  <p className="response-text">
                    {a || <span className="loading-text">Generating response...</span>}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Example Questions */}
          {!a && !loading && (
            <div className="examples-card">
              <h3 className="examples-title">Example Questions</h3>
              <div className="examples-list">
                {[
                  "What medication is prescribed for hypertension?",
                  "What is the patient's A1C level?",
                  "What triggers asthma symptoms in the patient?",
                  "What lifestyle changes are recommended for blood pressure?",
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setQ(example)}
                    className="example-button"
                  >
                    <span className="example-icon">→</span>
                    <span className="example-text">{example}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="page-footer">
        <p className="footer-text">
          <span className="footer-icon">🏥</span>
          Powered by Ollama · Local AI · Zero API Costs
        </p>
      </footer>
    </div>
  );
}
