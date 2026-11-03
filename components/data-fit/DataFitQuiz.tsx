"use client";

import { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import {
  QUESTIONS,
  QUESTION_COUNT,
  QUIZ_INTRO_HELPER,
  toggleMulti,
  type Answers,
  type QuestionId,
} from "@/lib/data-fit/questions";
import { evaluate, validateQuestion, type ResultType } from "@/lib/data-fit/result";
import { OptionItem } from "./OptionItem";
import { ResultView } from "./ResultView";

type Phase = "intro" | "question" | "result";

type State = {
  phase: Phase;
  step: number;
  answers: Answers;
  error: string | null;
  fromResult: boolean;
  /** Incremented on every navigation so focus management can react. */
  nav: number;
};

type Action =
  | { type: "start" }
  | { type: "single"; id: QuestionId; value: string }
  | { type: "multi"; id: QuestionId; value: string; exclusive: readonly string[] }
  | { type: "continue" }
  | { type: "back" }
  | { type: "to_result" }
  | { type: "edit"; step: number }
  | { type: "restart" }
  | { type: "exit" };

const initial: State = { phase: "intro", step: 0, answers: {}, error: null, fromResult: false, nav: 0 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...initial, phase: "question", nav: state.nav + 1 };
    case "single":
      return { ...state, error: null, answers: { ...state.answers, [action.id]: action.value } };
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
      if (error) return { ...state, error };
      if (state.step >= QUESTION_COUNT - 1) {
        return { ...state, phase: "result", error: null, fromResult: false, nav: state.nav + 1 };
      }
      return { ...state, step: state.step + 1, error: null, nav: state.nav + 1 };
    }
    case "back":
      if (state.step === 0) return { ...state, phase: "intro", error: null, nav: state.nav + 1 };
      return { ...state, step: state.step - 1, error: null, nav: state.nav + 1 };
    case "to_result": {
      const q = QUESTIONS[state.step];
      const error = validateQuestion(q.id, state.answers);
      if (error) return { ...state, error };
      if (evaluate(state.answers).status !== "complete") return { ...state, error: "Answer the remaining questions to see your result." };
      return { ...state, phase: "result", error: null, fromResult: false, nav: state.nav + 1 };
    }
    case "edit":
      return { ...state, phase: "question", step: action.step, error: null, fromResult: true, nav: state.nav + 1 };
    case "restart":
      return { ...initial, phase: "question", nav: state.nav + 1 };
    case "exit":
      return { ...initial, nav: state.nav + 1 };
  }
}

export type DataFitQuizProps = {
  /** Short id for where this instance lives, e.g. "home-fit-check". Sent with inquiries; never contains PII. */
  origin: string;
  /** Skip the intro screen (used on /data-fit). */
  autoStart?: boolean;
  /** Where "Return to page" goes when the quiz is exited or finished. */
  returnHref?: string;
  returnLabel?: string;
  startLabel?: string;
};

export function DataFitQuiz({
  origin,
  autoStart = false,
  returnHref = "/",
  returnLabel = "Return to the page",
  startLabel = "Start the fit check",
}: DataFitQuizProps) {
  const [state, dispatch] = useReducer(reducer, initial, (s) =>
    autoStart ? { ...s, phase: "question" as Phase } : s,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Move focus to the current question/result heading after each navigation.
  useEffect(() => {
    if (state.nav === 0) return;
    headingRef.current?.focus({ preventScroll: false });
  }, [state.nav]);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state.error]);

  if (state.phase === "intro") {
    return (
      <div className="border-t border-gray-200 pt-8">
        <p className="max-w-xl text-sm leading-relaxed text-gray-600">{QUIZ_INTRO_HELPER}</p>
        <button type="button" onClick={() => dispatch({ type: "start" })} className="btn-primary mt-6">
          {startLabel}
        </button>
      </div>
    );
  }

  if (state.phase === "result") {
    const evaluated = evaluate(state.answers);
    if (evaluated.status !== "complete") {
      // Should be unreachable: the reducer only enters "result" after validation.
      return (
        <div className="border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-600">Some answers are missing. Please restart the fit check.</p>
          <button type="button" onClick={() => dispatch({ type: "restart" })} className="btn-primary mt-6">
            Restart
          </button>
        </div>
      );
    }
    return (
      <ResultView
        headingRef={headingRef}
        answers={evaluated.answers}
        result={evaluated.result as ResultType}
        origin={origin}
        onEdit={(step) => dispatch({ type: "edit", step })}
        onRestart={() => dispatch({ type: "restart" })}
        returnHref={returnHref}
        returnLabel={returnLabel}
      />
    );
  }

  const q = QUESTIONS[state.step];
  const groupName = `q-${q.id}`;
  const errorId = `${groupName}-error`;
  const helperId = q.helper ? `${groupName}-helper` : undefined;
  const progressId = `${groupName}-progress`;
  const current = state.answers[q.id];
  const canReturnToResult = state.fromResult && evaluate(state.answers).status === "complete";

  return (
    <div className="border-t border-gray-200 pt-8" data-step={state.step + 1}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p id={progressId} className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
          Question {state.step + 1} of {QUESTION_COUNT}
        </p>
        <ol className="flex gap-1.5" aria-hidden>
          {QUESTIONS.map((item, i) => (
            <li
              key={item.id}
              className={`h-1 w-5 ${i <= state.step ? "bg-black" : "bg-gray-300"}`}
            />
          ))}
        </ol>
      </div>

      {state.step === 0 && (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-600">{QUIZ_INTRO_HELPER}</p>
      )}

      <fieldset
        className="mt-8"
        aria-describedby={[helperId, state.error ? errorId : null].filter(Boolean).join(" ") || undefined}
      >
        <legend className="w-full">
          <h3
            ref={headingRef}
            tabIndex={-1}
            aria-describedby={progressId}
            className="max-w-2xl text-2xl font-medium tracking-tight outline-none lg:text-3xl"
          >
            {q.legend}
          </h3>
        </legend>
        {q.helper && (
          <p id={helperId} className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600">
            {q.helper}
          </p>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {q.options.map((opt) => {
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
                onChange={() =>
                  q.kind === "multi"
                    ? dispatch({ type: "multi", id: q.id, value: opt.value, exclusive: q.exclusive })
                    : dispatch({ type: "single", id: q.id, value: opt.value })
                }
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
          className="mt-4 flex items-center gap-2 text-sm font-medium text-black outline-none"
        >
          <span aria-hidden className="inline-block h-4 w-4 border border-black text-center font-mono text-[10px] leading-[14px]">
            !
          </span>
          {state.error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" onClick={() => dispatch({ type: "continue" })} className="btn-primary min-h-[44px]">
            {state.step === QUESTION_COUNT - 1 ? "See your result" : "Continue"}
          </button>
          <button type="button" onClick={() => dispatch({ type: "back" })} className="btn-ghost min-h-[44px]">
            Back
          </button>
          {canReturnToResult && (
            <button type="button" onClick={() => dispatch({ type: "to_result" })} className="btn-ghost min-h-[44px]">
              Back to result
            </button>
          )}
        </div>
        {autoStart ? (
          <Link href={returnHref} className="link-arrow min-h-[44px] text-gray-600">
            {returnLabel}
          </Link>
        ) : (
          <button type="button" onClick={() => dispatch({ type: "exit" })} className="link-arrow min-h-[44px] text-gray-600">
            {returnLabel}
          </button>
        )}
      </div>
    </div>
  );
}
