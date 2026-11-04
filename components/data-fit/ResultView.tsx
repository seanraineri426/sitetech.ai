"use client";

import { useState, type RefObject } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { QUESTIONS, optionLabel, type CompleteAnswers } from "@/lib/data-fit/questions";
import { reviewQuestions, type ResultType } from "@/lib/data-fit/result";
import { INVENTORY_NO_TASKS_NOTE, RESULT_COMMON_NOTE, RESULT_COPY } from "@/lib/data-fit/copy";
import { computeValuation } from "@/lib/data-fit/valuation";
import { CasinoReveal } from "./CasinoReveal";

type Props = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  answers: CompleteAnswers;
  result: ResultType;
  onEdit: (step: number) => void;
  onRestart: () => void;
  returnHref: string;
  returnLabel: string;
};

const eyebrow = "font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80";

function Dash() {
  return <span aria-hidden className="mt-[10px] h-px w-5 shrink-0 bg-white/30" />;
}

export function ResultView({
  headingRef,
  answers,
  result,
  onEdit,
  onRestart,
  returnHref,
  returnLabel,
}: Props) {
  const copy = RESULT_COPY[result];
  const intent = answers.next;
  const valuation = computeValuation(answers);
  const [settled, setSettled] = useState(false);

  return (
    <div className="text-white">
      <CasinoReveal valuation={valuation} headingRef={headingRef} onSettled={() => setSettled(true)} />

      {settled && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="border-t border-gold/20 px-5 py-8 sm:px-8"
        >
          <div className="mx-auto max-w-2xl border border-gold/40 bg-gold/[0.06] p-4" role="status">
            <p className={eyebrow}>Request received</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-200">
              SiteTech has your request and will review it, then follow up about a possible next step. Receipt
              is not an introduction, a match, or a transaction. Any introduction would need your separate
              approval, naming the recipient and the information to be shared.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <p className={eyebrow}>{copy.label}</p>
            <h3 className="mt-3 text-2xl font-medium tracking-tight">{copy.heading}</h3>
            <p className="mt-4 text-base leading-relaxed text-gray-300">{copy.body}</p>

            {result === "INVENTORY_FIRST" && copy.checklist && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <p className={eyebrow}>Your simple first checklist</p>
                <ol className="mt-4 space-y-3">
                  {copy.checklist.map((it, i) => (
                    <li key={it} className="flex gap-4 text-sm leading-relaxed text-gray-200">
                      <span className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
                      {it}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-sm text-gray-400">{INVENTORY_NO_TASKS_NOTE}</p>
              </div>
            )}

            {result === "PERMISSIONS_AND_SCOPE_REVIEW" && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <p className={eyebrow}>What to sort out first</p>
                <ul className="mt-4 space-y-3">
                  {reviewQuestions(answers).map((it) => (
                    <li key={it} className="flex gap-4 text-sm leading-relaxed text-gray-200">
                      <Dash />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result === "INITIAL_CONVERSATION" && intent === "internal_review" && (
              <div className="mt-8 border-t border-white/10 pt-6">
                <p className={eyebrow}>Worth checking before you talk</p>
                <ul className="mt-4 space-y-3">
                  {[
                    "Which kinds of records you would consider, and roughly how far back they go.",
                    "Who in your company can approve an outside conversation about them.",
                    "Which records should stay completely out of the discussion.",
                  ].map((it) => (
                    <li key={it} className="flex gap-4 text-sm leading-relaxed text-gray-200">
                      <Dash />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href="/how-it-works" className="link-arrow min-h-[44px] text-gray-200">
                See how the process works <span aria-hidden>→</span>
              </Link>
              {intent === "learn_process" && (
                <Link href="/#faq" className="link-arrow min-h-[44px] text-gray-200">
                  Read the FAQ <span aria-hidden>→</span>
                </Link>
              )}
            </div>

            <div className="mt-10 border-t border-white/10 pt-8">
              <div className="flex items-center justify-between gap-4">
                <p className={eyebrow}>Your answers</p>
                <button
                  type="button"
                  onClick={onRestart}
                  className="text-sm text-gray-300 underline-offset-4 hover:text-gold hover:underline"
                >
                  Spin again
                </button>
              </div>
              <dl className="mt-4 divide-y divide-white/10 border-y border-white/10">
                {QUESTIONS.map((q, i) => {
                  const val = answers[q.id];
                  const label = Array.isArray(val)
                    ? val.map((it) => optionLabel(q.id, it)).join("; ")
                    : optionLabel(q.id, String(val));
                  return (
                    <div key={q.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <dt className="text-xs text-gray-400">
                          <span className="font-mono">{String(i + 1).padStart(2, "0")}</span> {q.legend}
                        </dt>
                        <dd className="mt-1 text-sm text-white">{label}</dd>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEdit(i)}
                        className="justify-self-start text-sm text-gray-300 underline-offset-4 hover:text-gold hover:underline sm:justify-self-end"
                        aria-label={`Edit answer to question ${i + 1}`}
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-3 text-xs text-gray-500">
                Editing an answer reruns the formula. Because your answers changed, you confirm your details
                again before the new number opens.
              </p>
            </div>

            <p className="mt-8 text-sm leading-relaxed text-gray-400">{RESULT_COMMON_NOTE}</p>

            <div className="mt-6">
              <Link href={returnHref} className="link-arrow text-gray-300">
                {returnLabel}
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
