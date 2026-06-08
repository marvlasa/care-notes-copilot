"use client";

interface AskFormProps {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export function AskForm({ value, loading, onChange, onSubmit }: AskFormProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="ask-card">
      <div className="ask-card-header">
        <p className="ask-card-title">Clinical Question</p>
      </div>

      <textarea
        className="ask-textarea"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g., What medications are prescribed for hypertension in this patient?"
        disabled={loading}
        aria-label="Clinical question"
      />

      <div className="ask-card-footer">
        <span className="ask-hint">
          <kbd>⌘</kbd> + <kbd>Enter</kbd> to send
        </span>

        <button
          className="btn-primary"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          aria-label="Send question"
        >
          {loading ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Analyzing…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Ask Copilot
            </>
          )}
        </button>
      </div>
    </div>
  );
}
