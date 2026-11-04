"use client";

import { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  QUESTIONS,
  QUESTION_COUNT,
  QUIZ_INTRO_HELPER,
  toggleMulti,
  type Answers,
  type QuestionId,
} from "@/lib/data-fit/questions";
import { evaluate, validateQuestion, type ResultType } from "@/lib/data-fit/result";
import { answersKey } from "@/lib/data-fit/valuation";
import { CasinoHud } from "./CasinoHud";
import { OptionItem } from "./OptionItem";
import { ResultView } from "./ResultView";
import { UnlockGate, type GateContact } from "./UnlockGate";

type Phase = "intro" | "question" | "gate" | "reveal";

type State = {
  phase: Phase;
  step: number;
  answers: Answers;
  error: string | null;
  fromResult: boolean;
  nav: number;
  advancing: boolean;
  /** Held in memory only. Never written to storage, URLs, or analytics. */
  contact: GateContact;
  /** Key of the answers that were confirmed delivered. The number only opens for these. */
  submittedKey: string | null;
};

type Action =
  | { type: "start" }
  | { type: "single"; id: QuestionId; value: string; commit: boolean }
  | { type: "multi"; id: QuestionId; value: string; exclusive: readonly string[] }
  | { type: "continue" }
  | { type: "back" }
  | { type: "to_result" }
  | { type: "edit"; step: number }
  | { type: "restart" }
  | { type: "exit" }
  | { type: "unlocked"; contact: GateContact }
  | { type: "set_advancing"; value: boolean };

const emptyContact: GateContact = { name: "", email: "", company: "" };

const initial: State = {
  phase: "intro",
  step: 0,
  answers: {},
  error: null,
  fromResult: false,
  nav: 0,
  advancing: false,
  contact: emptyContact,
  submittedKey: null,
};

function finish(state: State): State {
  const evaluated = evaluate(state.answers);
  if (evaluated.status !== "complete") {
    return { ...state, error: "Answer the remaining questions to unlock your number.", advancing: false };
  }
  // Already delivered for exactly these answers: reopen without asking again.
  const phase: Phase = state.submittedKey === answersKey(state.answers) ? "reveal" : "gate";
  return { ...state, phase, error: null, fromResult: false, nav: state.nav + 1, advancing: false };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...initial, phase: "question", nav: state.nav + 1 };
    case "single":
      return {
        ...state,
        error: null,
        advancing: state.advancing || action.commit,
        answers: { ...state.answers, [action.id]: action.value },
      };
    case "multi": {
      const current = state.answers[action.id] as string[] | undefined;
      return {
        ...state,
        error: null,
        answers: { ...state.answers, [action.id]: toggleMulti(current, action.value, action.exclusive) },
      };
    }
    case "continue": {
      const q = QUESTIONS[state.step];
      const error = validateQuestion(q.id, state.answers);
      if (error) return { ...state, error, advancing: false };
      if (state.step >= QUESTION_COUNT - 1) return finish(state);
      return { ...state, step: state.step + 1, error: null, nav: state.nav + 1, advancing: false };
    }
    case "back":
      if (state.phase === "gate") {
        return { ...state, phase: "question", step: QUESTION_COUNT - 1, error: null, nav: state.nav + 1 };
      }
      if (state.step === 0) return { ...state, phase: "intro", error: null, nav: state.nav + 1, advancing: false };
      return { ...state, step: state.step - 1, error: null, nav: state.nav + 1, advancing: false };
    case "to_result": {
      const q = QUESTIONS[state.step];
      const error = validateQuestion(q.id, state.answers);
      if (error) return { ...state, error };
      return finish(state);
    }
    case "edit":
      return { ...state, phase: "question", step: action.step, error: null, fromResult: true, nav: state.nav + 1, advancing: false };
    case "restart":
      return { ...initial, phase: "question", nav: state.nav + 1 };
    case "exit":
      return { ...initial, nav: state.nav + 1 };
    case "unlocked":
      return {
        ...state,
        phase: "reveal",
        contact: action.contact,
        submittedKey: answersKey(state.answers),
        nav: state.nav + 1,
      };
    case "set_advancing":
      return { ...state, advancing: action.value };
  }
}

export type DataFitQuizProps = {
  origin: string;
  autoStart?: boolean;
  returnHref?: string;
  returnLabel?: string;
  startLabel?: string;
  /** Sits inside another page's hero: opens on Q1, no exit link, no Back on Q1. */
  embedded?: boolean;
};

export function DataFitQuiz({
  origin,
  autoStart = false,
  returnHref = "/",
  returnLabel = "Return to the page",
  startLabel = "Start the fit check",
  embedded = false,
}: DataFitQuizProps) {
  const [state, dispatch] = useReducer(reducer, initial, (s) =>
    autoStart || embedded ? { ...s, phase: "question" as Phase } : s,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (state.nav === 0) return;
    headingRef.current?.focus({ preventScroll: false });
  }, [state.nav]);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  // Tap, brief lock-in flash, then the next round for single-select questions.
  useEffect(() => {
    if (!state.advancing || state.phase !== "question") return;
    const q = QUESTIONS[state.step];
    if (q.kind !== "single") {
      dispatch({ type: "set_advancing", value: false });
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "continue" }), reduce ? 0 : 420);
    return () => clearTimeout(timer);
  }, [state.advancing, state.phase, state.step, reduce]);

  const evaluated = evaluate(state.answers);
  const complete = evaluated.status === "complete" ? evaluated : null;

  const variants = {
    enter: (p: Phase) =>
      reduce
        ? { opacity: 0 }
        : p === "reveal"
          ? { opacity: 0, scale: 0.92, filter: "blur(12px)" }
          : p === "gate"
            ? { opacity: 0, scale: 1.08, filter: "blur(10px)" }
            : { opacity: 0, x: 70, scale: 0.97, filter: "blur(8px)" },
    center: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" },
    exit: (p: Phase) =>
      reduce
        ? { opacity: 0 }
        : p === "reveal"
          ? { opacity: 0, scale: 1.1, filter: "blur(14px)" }
          : p === "gate"
            ? { opacity: 0, scale: 0.9, filter: "blur(10px)" }
            : { opacity: 0, x: -70, scale: 0.97, filter: "blur(8px)" },
  };

  const q = QUESTIONS[state.step];
  const groupName = `q-${q.id}`;
  const errorId = `${groupName}-error`;
  const helperId = q.helper ? `${groupName}-helper` : undefined;
  const progressId = `${groupName}-progress`;
  const current = state.answers[q.id];
  const roundsDone = state.phase === "intro" ? 0 : state.phase === "question" ? state.step : QUESTION_COUNT;

  const stageKey = state.phase === "question" ? `q-${state.step}` : state.phase;

  return (
    <div className="casino-border @container" data-step={state.step + 1} data-phase={state.phase}>
      <div className="casino-inner overflow-hidden">
        <div className="casino-bulbs" aria-hidden />
        {state.phase !== "reveal" && (
          <CasinoHud
            answers={state.answers}
            round={roundsDone}
            total={QUESTION_COUNT}
            sealed={state.phase === "gate"}
          />
        )}

        {/* Gold sweep on every round change. */}
        {!reduce && state.phase === "question" && (
          <motion.span
            key={`sweep-${state.step}`}
            aria-hidden
            className="pointer-events-none absolute left-0 top-2 z-10 h-[2px] w-1/2 bg-gradient-to-r from-transparent via-gold to-transparent"
            initial={{ x: "-100%", opacity: 1 }}
            animate={{ x: "300%", opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}

        <AnimatePresence mode="wait" custom={state.phase} initial={false}>
          <motion.div
            key={stageKey}
            custom={state.phase}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {state.phase === "intro" && (
              <div className="px-5 py-8 sm:px-8 sm:py-10">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold/80">
                  {QUESTION_COUNT} rounds
                </p>
                <h3 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Find out what your records could be worth.
                </h3>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-300">{QUIZ_INTRO_HELPER}</p>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">
                  Tap an answer and you move on. Each round unlocks a modeled value you can
                  calculate and cite. Your email opens the vault at the end.
                </p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "start" })}
                  className="mt-7 min-h-[52px] bg-gold px-8 py-3 font-mono text-sm font-semibold uppercase tracking-[0.2em] text-black shadow-[0_0_40px_rgba(245,196,81,0.35)] transition hover:bg-gold-soft"
                >
                  {startLabel}
                </button>
              </div>
            )}

            {state.phase === "question" && (
              <div className="px-5 py-8 sm:px-8">
                <p id={progressId} className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
                  Round {state.step + 1} of {QUESTION_COUNT}
                  {q.kind === "single" ? " / tap to lock in" : " / select all that apply"}
                </p>

                {state.step === 0 && (
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">{QUIZ_INTRO_HELPER}</p>
                )}

                <fieldset
                  className="mt-5"
                  aria-describedby={[helperId, state.error ? errorId : null].filter(Boolean).join(" ") || undefined}
                >
                  <legend className="w-full">
                    <h3
                      ref={headingRef}
                      tabIndex={-1}
                      aria-describedby={progressId}
                      className="max-w-2xl text-2xl font-semibold tracking-tight outline-none lg:text-3xl"
                    >
                      {q.legend}
                    </h3>
                  </legend>
                  {q.helper && (
                    <p id={helperId} className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">
                      {q.helper}
                    </p>
                  )}

                  <div className="mt-6 grid gap-2.5 @2xl:grid-cols-2">
                    {q.options.map((opt, i) => {
                      const checked =
                        q.kind === "multi"
                          ? ((current as string[] | undefined) ?? []).includes(opt.value)
                          : current === opt.value;
                      return (
                        <OptionItem
                          key={opt.value}
                          kind={q.kind}
                          name={groupName}
                          value={opt.value}
                          label={opt.label}
                          checked={checked}
                          index={i}
                          onChange={() =>
                            q.kind === "multi"
                              ? dispatch({ type: "multi", id: q.id, value: opt.value, exclusive: q.exclusive })
                              : dispatch({ type: "single", id: q.id, value: opt.value, commit: false })
                          }
                          onCommit={() => dispatch({ type: "single", id: q.id, value: opt.value, commit: true })}
                        />
                      );
                    })}
                  </div>
                </fieldset>

                {state.error && (
                  <p
                    id={errorId}
                    ref={errorRef}
                    tabIndex={-1}
                    role="alert"
                    className="mt-4 flex items-center gap-2 text-sm font-medium text-gold outline-none"
                  >
                    <span aria-hidden className="inline-block h-4 w-4 border border-gold text-center font-mono text-[10px] leading-[14px]">
                      !
                    </span>
                    {state.error}
                  </p>
                )}

                <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {q.kind === "multi" && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "continue" })}
                        disabled={state.advancing}
                        className="min-h-[48px] bg-gold px-6 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-gold-soft disabled:opacity-60"
                      >
                        Lock it in
                      </button>
                    )}
                    {!(embedded && state.step === 0) && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "back" })}
                        disabled={state.advancing}
                        className="min-h-[44px] px-2 font-mono text-xs uppercase tracking-[0.2em] text-gray-400 transition hover:text-white"
                      >
                        Back
                      </button>
                    )}
                    {state.fromResult && complete && (
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "to_result" })}
                        className="min-h-[44px] px-2 font-mono text-xs uppercase tracking-[0.2em] text-gray-400 transition hover:text-white"
                      >
                        Back to result
                      </button>
                    )}
                  </div>
                  {embedded ? null : autoStart ? (
                    <Link href={returnHref} className="link-arrow min-h-[44px] text-gray-400">
                      {returnLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "exit" })}
                      className="link-arrow min-h-[44px] text-gray-400"
                    >
                      {returnLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            {state.phase === "gate" && complete && (
              <div className="px-5 py-10 sm:px-8">
                <UnlockGate
                  headingRef={headingRef}
                  answers={complete.answers}
                  result={complete.result as ResultType}
                  origin={origin}
                  initial={state.contact}
                  onBack={() => dispatch({ type: "back" })}
                  onUnlocked={(contact) => dispatch({ type: "unlocked", contact })}
                />
              </div>
            )}

            {state.phase === "reveal" && complete && (
              <ResultView
                headingRef={headingRef}
                answers={complete.answers}
                result={complete.result as ResultType}
                onEdit={(step) => dispatch({ type: "edit", step })}
                onRestart={() => dispatch({ type: "restart" })}
                returnHref={returnHref}
                returnLabel={embedded ? "" : returnLabel}
              />
            )}

            {(state.phase === "gate" || state.phase === "reveal") && !complete && (
              <div className="px-5 py-10 sm:px-8">
                <p className="text-sm text-gray-300">Some answers are missing. Please restart the fit check.</p>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "restart" })}
                  className="mt-6 min-h-[48px] bg-gold px-6 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-black"
                >
                  Restart
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
