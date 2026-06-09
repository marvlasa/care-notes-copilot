"use client";

import { Icon } from "./icons";

interface AnswerCardProps {
  answer: string;
  streaming: boolean;
}

export function AnswerCard({ answer, streaming }: AnswerCardProps) {
  return (
    <div className="answer-card" role="region" aria-label="AI response">
      <div className="answer-header">
        <div className="answer-header-left">
          <div className="answer-icon tile" aria-hidden="true">
            <Icon>
              <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
              <path d="M12 2a10 10 0 0 1 10 10" />
              <circle cx="12" cy="12" r="3" />
            </Icon>
          </div>
          <span className="answer-label eyebrow">Copilot Response</span>
        </div>

        {streaming && (
          <div className="streaming-badge" aria-live="polite" aria-label="Streaming response">
            <span className="streaming-dot dot" aria-hidden="true" />
            Live
          </div>
        )}
      </div>

      <div className="answer-body" aria-live="polite">
        {answer || (
          <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
            Generating response…
          </span>
        )}
      </div>
    </div>
  );
}
