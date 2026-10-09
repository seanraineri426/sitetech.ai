'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ActionCardData } from '@/lib/actions/types';
import { redactAddresses } from '@/lib/redact/addresses';

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
                    <p className="text-base">{redactAddresses(why.subject)}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Excerpt</p>
                    <blockquote className="text-base border-l-2 border-primary pl-4 italic">
                      &ldquo;{redactAddresses(why.quote)}&rdquo;
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
              <p>Subject: {redactAddresses(data.draft.subject)}</p>
              <p className="line-clamp-2">{redactAddresses(data.draft.body)}</p>
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
