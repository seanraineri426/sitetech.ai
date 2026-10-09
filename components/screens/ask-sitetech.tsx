'use client';

import { useState } from 'react';
import { ScenarioChart, type ScenarioDataPoint } from '@/components/charts/scenario-chart';

export interface AskAnswer {
  text: string;
  chart: ScenarioDataPoint[] | null;
  suggestions: string[];
}

export interface AskSiteTechProps {
  answer: AskAnswer | null;
  recentQuestions: string[];
  onAsk: (question: string) => void;
}

export function AskSiteTech({ answer, recentQuestions, onAsk }: AskSiteTechProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      onAsk(question.trim());
      setQuestion('');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Ask SiteTech</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question or tell SiteTech to prepare something..."
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
            aria-label="Voice input"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              <path
                d="M10 12.5a2.5 2.5 0 002.5-2.5V5a2.5 2.5 0 00-5 0v5a2.5 2.5 0 002.5 2.5z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M15 10a5 5 0 01-10 0M10 15v2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Try asking:</span>
          <button
            type="button"
            onClick={() => setQuestion('Which RFIs block next week?')}
            className="text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Which RFIs block next week?
          </button>
          <button
            type="button"
            onClick={() => setQuestion('Open owner decisions')}
            className="text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Open owner decisions
          </button>
          <button
            type="button"
            onClick={() => setQuestion('Unpaid changes this month')}
            className="text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Unpaid changes this month
          </button>
        </div>
      </form>

      {answer && (
        <div className="space-y-6 bg-card border border-border rounded-lg p-6">
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground">{answer.text}</p>
          </div>

          {answer.chart && answer.chart.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4">
              <ScenarioChart data={answer.chart} />
            </div>
          )}

          {answer.suggestions.length > 0 && (
            <div className="space-y-2">
              {answer.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onAsk(suggestion)}
                  className="w-full text-left px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors min-h-[44px]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!answer && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <p className="text-muted-foreground text-sm">
              SiteTech only prepares actions it can check against your records.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Anything else you can&apos;t do here yet the closed thing it can do.
            </p>
          </div>

          {recentQuestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recent</h3>
              {recentQuestions.map((q, index) => (
                <button
                  key={index}
                  onClick={() => setQuestion(q)}
                  className="w-full text-left px-4 py-2 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
