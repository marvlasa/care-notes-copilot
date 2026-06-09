"use client";

import { Icon, ARROW } from "./icons";

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
        <p className="ask-card-title eyebrow">Clinical Question</p>
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
              <Icon>{ARROW}</Icon>
              Ask Copilot
            </>
          )}
        </button>
      </div>
    </div>
  );
}
