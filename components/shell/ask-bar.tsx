'use client';

import { useState, useEffect, useRef } from 'react';

export interface AskBarProps {
  onAsk: (question: string) => void;
}

export function AskBar({ onAsk }: AskBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      onAsk(question.trim());
      setQuestion('');
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh] px-4"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-4">
          <div className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 20 20"
              className="text-muted-foreground"
            >
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12.5 12.5l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask SiteTech or tell it to do something..."
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground min-h-[44px]"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
              ESC
            </kbd>
          </div>
        </form>

        <div className="border-t border-border p-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              onAsk('Which RFIs block next week?');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm text-foreground min-h-[44px]"
          >
            Which RFIs block next week?
          </button>
          <button
            type="button"
            onClick={() => {
              onAsk('Chase the curtain wall shop drawings');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm text-foreground min-h-[44px]"
          >
            Chase the curtain wall shop drawings
          </button>
          <button
            type="button"
            onClick={() => {
              onAsk('Draft the change event for the owner\'s EV charger email');
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm text-foreground min-h-[44px]"
          >
            Draft the change event for the owner&apos;s EV charger email
          </button>
        </div>
      </div>
    </div>
  );
}
