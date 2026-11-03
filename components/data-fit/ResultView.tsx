"use client";

import { useState, type RefObject } from "react";
import Link from "next/link";
import { QUESTIONS, optionLabel, type CompleteAnswers } from "@/lib/data-fit/questions";
import { reviewQuestions, type ResultType } from "@/lib/data-fit/result";
import { INVENTORY_NO_TASKS_NOTE, RESULT_COMMON_NOTE, RESULT_COPY } from "@/lib/data-fit/copy";
import { InquiryForm } from "./InquiryForm";

type Props = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  answers: CompleteAnswers;
  result: ResultType;
  origin: string;
  onEdit: (step: number) => void;
  onRestart: () => void;
  returnHref: string;
  returnLabel: string;
};

type FormMode = "none" | "supplier_conversation" | "process_question";

export function ResultView({
  headingRef,
  answers,
  result,
  origin,
  onEdit,
  onRestart,
  returnHref,
  returnLabel,
}: Props) {
  const [formMode, setFormMode] = useState<FormMode>("none");
  const copy = RESULT_COPY[result];
  const intent = answers.next;

  const showProcessQuestion =
    intent !== "nothing" && intent !== "learn_process" && result !== "INITIAL_CONVERSATION";
  const showConversation = intent !== "nothing" && result === "INITIAL_CONVERSATION";
  const conversationIsPrimary = showConversation && intent === "explore_introduction";

  return (
    <div className="border-t border-gray-200 pt-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">{copy.label}</p>
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mt-4 max-w-2xl text-2xl font-medium tracking-tight outline-none lg:text-3xl"
      >
        {copy.heading}
      </h3>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-600">{copy.body}</p>

      {result === "INVENTORY_FIRST" && copy.checklist && (
        <div className="mt-8 max-w-2xl border-t border-gray-200 pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Your simple first checklist
          </p>
          <ol className="mt-4 space-y-3">
            {copy.checklist.map((item, i) => (
              <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-700">
                <span className="font-mono text-xs text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                {item}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-gray-500">{INVENTORY_NO_TASKS_NOTE}</p>
        </div>
      )}

      {result === "PERMISSIONS_AND_SCOPE_REVIEW" && (
        <div className="mt-8 max-w-2xl border-t border-gray-200 pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
            What to sort out first
          </p>
          <ul className="mt-4 space-y-3">
            {reviewQuestions(answers).map((item) => (
              <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-700">
                <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-gray-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result === "INITIAL_CONVERSATION" && intent === "internal_review" && (
        <div className="mt-8 max-w-2xl border-t border-gray-200 pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Worth checking before you talk
          </p>
          <ul className="mt-4 space-y-3">
            {[
              "Which kinds of records you would consider, and roughly how far back they go.",
              "Who in your company can approve an outside conversation about them.",
              "Which records should stay completely out of the discussion.",
            ].map((item) => (
              <li key={item} className="flex gap-4 text-sm leading-relaxed text-gray-700">
                <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-gray-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next-step actions, chosen by Q8. They never change the result above. */}
      <div className="mt-8 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
        {intent === "nothing" ? (
          <p className="text-sm text-gray-600">
            We'll leave it there. Nothing will be sent, and you can restart anytime.
          </p>
        ) : (
          <>
            {showConversation && (
              <button
                type="button"
                onClick={() => setFormMode("supplier_conversation")}
                aria-expanded={formMode === "supplier_conversation"}
                aria-controls="inquiry-form"
                className={`${conversationIsPrimary ? "btn-primary" : "btn-ghost"} min-h-[44px]`}
              >
                Ask SiteTech to explore this
              </button>
            )}
            {showProcessQuestion && (
              <button
                type="button"
                onClick={() => setFormMode("process_question")}
                aria-expanded={formMode === "process_question"}
                aria-controls="inquiry-form"
                className="btn-ghost min-h-[44px]"
              >
                Ask how this works
              </button>
            )}
            <Link href="/how-it-works" className="link-arrow min-h-[44px] text-gray-700">
              See how the process works <span aria-hidden>→</span>
            </Link>
            {intent === "learn_process" && (
              <Link href="/#faq" className="link-arrow min-h-[44px] text-gray-700">
                Read the FAQ <span aria-hidden>→</span>
              </Link>
            )}
          </>
        )}
      </div>

      {formMode !== "none" && (
        <div id="inquiry-form" className="mt-10 border-t border-gray-200 pt-8">
          <InquiryForm
            inquiryType={formMode}
            quiz={{ answers, resultType: result }}
            ctaOrigin={origin}
            heading={
              formMode === "supplier_conversation"
                ? "Ask SiteTech to explore a buyer conversation"
                : "Ask how this works"
            }
            intro={
              formMode === "supplier_conversation"
                ? "We'll review your answers and follow up if a conversation may make sense. Sending this does not share your company or records with a buyer."
                : "Ask in plain English. This does not change your result above, and nothing is shared with a buyer."
            }
            onCancel={() => setFormMode("none")}
          />
        </div>
      )}

      {/* Editable answer summary */}
      <div className="mt-10 border-t border-gray-200 pt-8">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">Your answers</p>
          <button type="button" onClick={onRestart} className="text-sm text-gray-600 underline-offset-4 hover:underline">
            Restart
          </button>
        </div>
        <dl className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
          {QUESTIONS.map((q, i) => {
            const v = answers[q.id];
            const label = Array.isArray(v)
              ? v.map((item) => optionLabel(q.id, item)).join("; ")
              : optionLabel(q.id, String(v));
            return (
              <div key={q.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <dt className="text-xs text-gray-500">
                    <span className="font-mono">{String(i + 1).padStart(2, "0")}</span> {q.legend}
                  </dt>
                  <dd className="mt-1 text-sm text-black">{label}</dd>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  className="justify-self-start text-sm text-gray-600 underline-offset-4 hover:underline sm:justify-self-end"
                  aria-label={`Edit answer to question ${i + 1}`}
                >
                  Edit
                </button>
              </div>
            );
          })}
        </dl>
      </div>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-gray-500">{RESULT_COMMON_NOTE}</p>

      <div className="mt-6">
        <Link href={returnHref} className="link-arrow text-gray-600">
          {returnLabel}
        </Link>
      </div>
    </div>
  );
}
