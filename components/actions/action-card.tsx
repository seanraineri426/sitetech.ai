'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActionCardData } from '@/lib/actions/types';

interface ActionCardProps {
  data: ActionCardData;
  onApprove: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}

const ALLOWED_HOSTS = [
  'outlook.office.com',
  'outlook.office365.com',
  'outlook.live.com',
] as const;

export function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') {
      return false;
    }
    
    if (url.username || url.password) {
      return false;
    }
    
    if (url.port && url.port !== '443') {
      return false;
    }
    
    if (ALLOWED_HOSTS.includes(url.hostname as (typeof ALLOWED_HOSTS)[number])) {
      return true;
    }
    
    if (url.hostname.endsWith('.procore.com') && url.hostname.split('.').length >= 3) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

function formatRisk(daysAtRisk: number | null, dollarsAtRisk: number | null): string | null {
  const parts: string[] = [];
  
  if (daysAtRisk !== null) {
    parts.push(`${daysAtRisk} ${daysAtRisk === 1 ? 'day' : 'days'}`);
  }
  
  if (dollarsAtRisk !== null) {
    const absCents = Math.abs(dollarsAtRisk);
    if (absCents > 0 && absCents < 100) {
      parts.push(dollarsAtRisk < 0 ? '-under $1' : 'under $1');
    } else {
      const dollars = Math.round(dollarsAtRisk / 100);
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
      parts.push(formatter.format(dollars));
    }
  }
  
  if (parts.length === 0) {
    return null;
  }
  
  return `${parts.join(' · ')} at risk`;
}

function formatDueDate(isoDate: string | null, timeZone: string): string | null {
  if (!isoDate) {
    return null;
  }
  
  try {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }
    
    const [, year, month, day] = match;
    const dateStr = `${year}-${month}-${day}T12:00:00`;
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone,
    });
  } catch {
    return null;
  }
}

export function ActionCard({ data, onApprove, onEdit, onDismiss }: ActionCardProps) {
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const riskText = formatRisk(data.daysAtRisk, data.dollarsAtRisk);
  const dueDateText = formatDueDate(data.dueBy, data.timeZone);
  const ownerText = data.ownerName ? `${data.ownerRole} · ${data.ownerName}` : data.ownerRole;
  const sourceUrlValid = isAllowedUrl(data.why.sourceUrl);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showCopied) {
      timer = setTimeout(() => setShowCopied(false), 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showCopied]);

  const handleApproveClick = async () => {
    const { href, copyText } = data.handoff;

    if (href && !isAllowedUrl(href)) {
      setHandoffError('This link can\'t be opened safely');
      return;
    }

    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }

    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        setShowCopied(true);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }

    onApprove();
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <h3 className="text-base font-semibold leading-snug">{data.headline}</h3>
        
        <div className="space-y-1 text-sm text-muted-foreground">
          {riskText && <p className="font-medium text-foreground">{riskText}</p>}
          {dueDateText && <p>Due: {dueDateText}</p>}
          <p>{ownerText}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <div>
          <button
            onClick={() => setWhyExpanded(!whyExpanded)}
            className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded min-h-[44px] inline-flex items-center"
            aria-expanded={whyExpanded}
          >
            <span className="inline-flex items-center gap-1">
              Why{' '}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                style={{ transform: whyExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          
          {whyExpanded && (
            <div className="mt-2 pl-4 border-l-2 border-muted space-y-1">
              <p className="text-sm font-medium">{data.why.label}</p>
              {data.why.kind === 'email_quote' && (
                <blockquote className="text-sm text-muted-foreground italic">
                  &ldquo;{data.why.quote}&rdquo;
                </blockquote>
              )}
              {sourceUrlValid ? (
                <a
                  href={data.why.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center min-h-[44px]"
                >
                  View source →
                </a>
              ) : (
                <span className="text-sm text-muted-foreground inline-block">
                  {data.why.sourceUrl}
                </span>
              )}
            </div>
          )}
        </div>

        {data.confirmFlags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.confirmFlags.includes('confirm_owner') && (
              <Badge variant="secondary">Confirm owner</Badge>
            )}
            {data.confirmFlags.includes('confirm_activity') && (
              <Badge variant="secondary">Confirm activity</Badge>
            )}
          </div>
        )}

        <div className="bg-muted/50 rounded-md p-3 text-sm">
          <p className="font-medium mb-1">Draft ready:</p>
          {data.draft.kind === 'email' && (
            <div className="space-y-0.5 text-muted-foreground">
              <p>To: {data.draft.to}</p>
              <p>Subject: {data.draft.subject}</p>
              <p className="line-clamp-2">{data.draft.body}</p>
            </div>
          )}
          {data.draft.kind === 'procore_paste' && (
            <p className="text-muted-foreground line-clamp-2">{data.draft.body}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-3">
        <Button
          onClick={handleApproveClick}
          className="w-full min-h-[44px]"
          size="lg"
        >
          {data.handoff.label}
        </Button>
        
        {handoffError && (
          <p className="text-sm text-destructive font-medium text-center">{handoffError}</p>
        )}
        
        {showCopied && (
          <p className="text-sm text-green-600 font-medium text-center" aria-live="polite">
            ✓ Copied
          </p>
        )}
        
        <div className="flex gap-2 w-full">
          <Button
            onClick={onEdit}
            variant="outline"
            className="flex-1 min-h-[44px]"
            size="lg"
          >
            Edit
          </Button>
          <Button
            onClick={onDismiss}
            variant="outline"
            className="flex-1 min-h-[44px]"
            size="lg"
          >
            Dismiss
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
