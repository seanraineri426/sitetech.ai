'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActionCardData } from '@/lib/actions/types';
import { redactEmailAddresses } from '@/lib/actions/redact-email';

function WhyPanel({
  why,
  open,
  onClose,
}: {
  why: ActionCardData['why'];
  open: boolean;
  onClose: () => void;
}) {
  const secondaryLinkValid = why.secondaryLink ? isAllowedUrl(why.secondaryLink) : false;

  return (
    <Dialog.Root open={open} onOpenChange={(_, isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Popup className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <Dialog.Title className="text-lg font-semibold">Why this action</Dialog.Title>
              <Dialog.Close
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </Dialog.Close>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Source</p>
                <p className="text-base">{why.label}</p>
              </div>

              {why.kind === 'email_quote' && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">From</p>
                    <p className="text-base">
                      {why.senderCompany} · {why.senderRole}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p className="text-base">{why.date}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Subject</p>
                    <p className="text-base">{redactEmailAddresses(why.subject)}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Excerpt</p>
                    <blockquote className="text-base border-l-2 border-primary pl-4 italic">
                      &ldquo;{redactEmailAddresses(why.quote)}&rdquo;
                    </blockquote>
                  </div>
                </>
              )}

              {why.kind === 'record' && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p className="text-base">{why.date}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Details</p>
                    <p className="text-base">{why.description}</p>
                  </div>
                </>
              )}

              {secondaryLinkValid && (() => {
                try {
                  const url = new URL(why.secondaryLink!);
                  const isOutlook = url.hostname.includes('outlook');
                  const isProcore = url.hostname.includes('procore');
                  const label = isOutlook ? 'Open in Outlook' : isProcore ? 'Open in Procore' : 'Open link';
                  return (
                    <div className="pt-4 border-t">
                      <a
                        href={why.secondaryLink!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-2 min-h-[44px]"
                      >
                        {label} →
                      </a>
                    </div>
                  );
                } catch {
                  return null;
                }
              })()}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WhyPanel({
  why,
  open,
  onClose,
}: {
  why: ActionCardData['why'];
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const secondaryLinkValid = why.secondaryLink ? isAllowedUrl(why.secondaryLink) : false;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Why this action</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Source</p>
            <p className="text-base">{why.label}</p>
          </div>

          {why.kind === 'email_quote' && (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">From</p>
                <p className="text-base">
                  {why.senderCompany} · {why.senderRole}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p className="text-base">{why.date}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Subject</p>
                <p className="text-base">{why.subject}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Excerpt</p>
                <blockquote className="text-base border-l-2 border-primary pl-4 italic">
                  &ldquo;{why.quote}&rdquo;
                </blockquote>
              </div>
            </>
          )}

          {why.kind === 'record' && (
            <>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p className="text-base">{why.date}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Details</p>
                <p className="text-base">{why.description}</p>
              </div>
            </>
          )}

          {secondaryLinkValid && (
            <div className="pt-4 border-t">
              <a
                href={why.secondaryLink!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-2 min-h-[44px]"
              >
                {why.kind === 'email_quote' ? 'Open in Outlook' : 'Open in Procore'} →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  
  if (daysAtRisk !== null && Number.isFinite(daysAtRisk)) {
    parts.push(`${daysAtRisk} ${daysAtRisk === 1 ? 'day' : 'days'}`);
  }
  
  if (dollarsAtRisk !== null && Number.isFinite(dollarsAtRisk)) {
    const absCents = Math.abs(dollarsAtRisk);
    if (absCents > 0 && absCents < 100) {
      parts.push(dollarsAtRisk < 0 ? 'credit under $1' : 'under $1');
    } else {
      const absRounded = Math.round(absCents / 100);
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
      const sign = dollarsAtRisk < 0 ? '-' : '';
      parts.push(sign + formatter.format(absRounded));
    }
  }
  
  if (parts.length === 0) {
    return null;
  }
  
  return `${parts.join(' · ')} at risk`;
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function formatDueDate(isoDate: string | null, timeZone: string): string | null {
  if (!isoDate || !isValidTimeZone(timeZone)) {
    return null;
  }
  
  try {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }
    
    const [, yearStr, monthStr, dayStr] = match;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    const checkYear = date.getUTCFullYear();
    const checkMonth = date.getUTCMonth() + 1;
    const checkDay = date.getUTCDate();
    
    if (checkYear !== year || checkMonth !== month || checkDay !== day) {
      return null;
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return null;
  }
}

export function ActionCard({ data, onApprove, onEdit, onDismiss }: ActionCardProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const riskText = formatRisk(data.daysAtRisk, data.dollarsAtRisk);
  const dueDateText = formatDueDate(data.dueBy, data.timeZone);
  const ownerText = data.ownerName ? `${data.ownerRole} · ${data.ownerName}` : data.ownerRole;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (liveMessage) {
      timer = setTimeout(() => setLiveMessage(''), 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [liveMessage]);

  const handleApproveClick = async () => {
    setHandoffError(null);
    const { href, copyText } = data.handoff;

    if (href && !isAllowedUrl(href)) {
      setHandoffError('This link can\'t be opened safely');
      return;
    }

    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        setLiveMessage('Copied');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        setHandoffError('Failed to copy to clipboard');
        return;
      }
    }

    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }

    onApprove();
  };

  return (
    <>
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
              onClick={() => setWhyOpen(true)}
              className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded min-h-[44px] inline-flex items-center"
            >
              Why?
            </button>
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
              <p>To: {data.draft.toDisplay}</p>
              <p>Subject: {redactEmailAddresses(data.draft.subject)}</p>
              <p className="line-clamp-2">{redactEmailAddresses(data.draft.body)}</p>
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
            <p className="text-sm text-destructive font-medium text-center" role="alert">
              {handoffError}
            </p>
          )}
          
          <p className="text-sm text-green-600 font-medium text-center" aria-live="polite">
            {liveMessage && `✓ ${liveMessage}`}
          </p>
          
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

      <WhyPanel why={data.why} open={whyOpen} onClose={() => setWhyOpen(false)} />
    </>
  );
}
