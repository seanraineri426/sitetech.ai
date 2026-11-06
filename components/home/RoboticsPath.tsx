"use client";

import { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BOOKING_URL } from "@/lib/site";
import { LICENSE_HREF, ROBOTICS_INDUSTRIES, type RoboticsIndustryId } from "@/lib/doors";
import {
  ROBOTICS_HEADCOUNT,
  ROBOTICS_HOURS,
  ROBOTICS_RATE_PER_HOUR_USD,
  ROBOTICS_WEEKS_PER_YEAR,
  computeRoboticsPayout,
  formatRoboticsUsd,
  type RoboticsAnswers,
  type RoboticsHeadcountId,
  type RoboticsHoursId,
} from "@/lib/robotics";
import { CheckIcon } from "@/components/data-fit/casino-bits";

type Step = "industry" | "headcount" | "hours" | "result";

type State = {
  step: Step;
  answers: RoboticsAnswers;
  advancing: boolean;
  nav: number;
};

type Action =
  | { type: "pick_industry"; value: RoboticsIndustryId }
  | { type: "pick_headcount"; value: RoboticsHeadcountId }
  | { type: "pick_hours"; value: RoboticsHoursId }
  | { type: "continue" }
  | { type: "back" }
  | { type: "restart" }
  | { type: "set_advancing"; value: boolean };

const STEPS: Step[] = ["industry", "headcount", "hours", "result"];

const initial: State = {
  step: "industry",
  answers: {},
  advancing: false,
  nav: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "pick_industry":
      return {
        ...state,
        answers: { ...state.answers, industry: action.value },
        advancing: true,
      };
    case "pick_headcount":
      return {
        ...state,
        answers: { ...state.answers, headcount: action.value },
        advancing: true,
      };
    case "pick_hours":
      return {
        ...state,
        answers: { ...state.answers, hours: action.value },
        advancing: true,
      };
    case "continue": {
      const i = STEPS.indexOf(state.step);
      const next = STEPS[Math.min(i + 1, STEPS.length - 1)];
      return { ...state, step: next, advancing: false, nav: state.nav + 1 };
    }
    case "back": {
      if (state.step === "industry") return state;
      const i = STEPS.indexOf(state.step);
      return {
        ...state,
        step: STEPS[Math.max(i - 1, 0)],
        advancing: false,
        nav: state.nav + 1,
      };
    }
    case "restart":
      return { ...initial, nav: state.nav + 1 };
    case "set_advancing":
      return { ...state, advancing: action.value };
  }
}

function OptionButton({
  label,
  checked,
  index,
  onPick,
  disabled,
}: {
  label: string;
  checked: boolean;
  index: number;
  onPick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onPick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 + index * 0.03, duration: 0.28 }}
      className={`flex min-h-[56px] w-full items-center gap-3.5 border px-4 py-3.5 text-left text-[15px] leading-snug transition-colors disabled:opacity-60 ${
        checked
          ? "border-gold bg-gold font-semibold text-black shadow-[0_0_28px_rgba(245,196,81,0.28)]"
          : "border-white/15 bg-white/[0.03] text-white hover:border-gold/60 hover:bg-white/[0.06]"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-black bg-black text-gold" : "border-white/35"
        }`}
      >
        {checked && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="flex-1">{label}</span>
    </motion.button>
  );
}

/**
 * Door 2 quiz: industry → headcount → hours/week → annual payout estimate.
 * annual = employees x hoursPerWeek x $10 x 52
 */
export function RoboticsPath() {
  const [state, dispatch] = useReducer(reducer, initial);
  const reduce = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.nav === 0) return;
    headingRef.current?.focus({ preventScroll: false });
  }, [state.nav]);

  useEffect(() => {
    if (!state.advancing || state.step === "result") return;
    const timer = setTimeout(() => dispatch({ type: "continue" }), reduce ? 0 : 320);
    return () => clearTimeout(timer);
  }, [state.advancing, state.step, reduce]);

  const stepIndex = STEPS.indexOf(state.step);
  const questionNumber = Math.min(stepIndex + 1, 3);
  const ready =
    state.answers.industry && state.answers.headcount && state.answers.hours
      ? computeRoboticsPayout({
          industry: state.answers.industry,
          headcount: state.answers.headcount,
          hours: state.answers.hours,
        })
      : null;

  return (
    <section id="record" className="section-dark-solid scroll-mt-24 border-t border-white/10 text-white">
      <div className="mx-auto max-w-[1400px] px-5 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-gold">Door two</p>
        <h2 className="mt-4 max-w-3xl text-3xl font-medium tracking-tight sm:text-4xl lg:text-5xl">
          Get paid to record work you already do.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
          Robotics training programs pay about {formatRoboticsUsd(ROBOTICS_RATE_PER_HOUR_USD)} per hour of
          first-person job footage. Three taps estimate what that could look like for your crew.
        </p>

        <div className="fit-border mt-10 @container">
          <div className="fit-inner overflow-hidden">
            {state.step !== "result" && (
              <div className="border-b border-gold/20 bg-black/40 px-5 py-4 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold/80">
                    Robotics estimate
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">
                    {questionNumber} of 3
                  </p>
                </div>
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 ${i < questionNumber ? "bg-gold" : "bg-white/10"}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.step}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="px-5 py-8 sm:px-8"
              >
                {state.step === "industry" && (
                  <fieldset>
                    <legend className="w-full">
                      <h3
                        ref={headingRef}
                        tabIndex={-1}
                        className="max-w-2xl text-2xl font-semibold tracking-tight outline-none lg:text-3xl"
                      >
                        What kind of work does your crew do?
                      </h3>
                    </legend>
                    <div className="mt-6 grid gap-2.5 @2xl:grid-cols-2">
                      {ROBOTICS_INDUSTRIES.map((item, i) => (
                        <OptionButton
                          key={item.id}
                          label={item.label}
                          checked={state.answers.industry === item.id}
                          index={i}
                          disabled={state.advancing}
                          onPick={() => dispatch({ type: "pick_industry", value: item.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                )}

                {state.step === "headcount" && (
                  <fieldset>
                    <legend className="w-full">
                      <h3
                        ref={headingRef}
                        tabIndex={-1}
                        className="max-w-2xl text-2xl font-semibold tracking-tight outline-none lg:text-3xl"
                      >
                        How many employees could record?
                      </h3>
                    </legend>
                    <p className="mt-3 max-w-xl text-sm text-gray-400">
                      People who could wear a camera while doing normal work.
                    </p>
                    <div className="mt-6 grid gap-2.5 @2xl:grid-cols-2">
                      {ROBOTICS_HEADCOUNT.map((item, i) => (
                        <OptionButton
                          key={item.id}
                          label={item.label}
                          checked={state.answers.headcount === item.id}
                          index={i}
                          disabled={state.advancing}
                          onPick={() => dispatch({ type: "pick_headcount", value: item.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                )}

                {state.step === "hours" && (
                  <fieldset>
                    <legend className="w-full">
                      <h3
                        ref={headingRef}
                        tabIndex={-1}
                        className="max-w-2xl text-2xl font-semibold tracking-tight outline-none lg:text-3xl"
                      >
                        About how many hours a week does each of them work?
                      </h3>
                    </legend>
                    <p className="mt-3 max-w-xl text-sm text-gray-400">
                      Use a typical week. The estimate multiplies headcount by these hours.
                    </p>
                    <div className="mt-6 grid gap-2.5 @2xl:grid-cols-2">
                      {ROBOTICS_HOURS.map((item, i) => (
                        <OptionButton
                          key={item.id}
                          label={item.label}
                          checked={state.answers.hours === item.id}
                          index={i}
                          disabled={state.advancing}
                          onPick={() => dispatch({ type: "pick_hours", value: item.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                )}

                {state.step === "result" && ready && (
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold/80">Your estimate</p>
                    <h3
                      ref={headingRef}
                      tabIndex={-1}
                      className="mt-2 text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
                    >
                      Modeled annual robotics payout
                    </h3>
                    <p className="mt-8 font-mono text-4xl font-semibold tracking-tight text-gold sm:text-5xl">
                      {formatRoboticsUsd(ready.annualUsd)}
                      <span className="ml-2 text-base font-medium tracking-normal text-gray-400">/ year</span>
                    </p>
                    <p className="mt-3 text-sm text-gray-300">
                      About {formatRoboticsUsd(ready.weeklyUsd)} per week at{" "}
                      {formatRoboticsUsd(ready.ratePerHourUsd)}/hour.
                    </p>

                    <div className="mt-8 border border-gold/30">
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/10 px-4 py-3 text-sm">
                        <span className="text-gray-300">People recording</span>
                        <span className="font-mono text-white">{ready.employees}</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/10 px-4 py-3 text-sm">
                        <span className="text-gray-300">Hours per person per week</span>
                        <span className="font-mono text-white">{ready.hoursPerWeek}</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-white/10 px-4 py-3 text-sm">
                        <span className="text-gray-300">Rate</span>
                        <span className="font-mono text-white">
                          {formatRoboticsUsd(ready.ratePerHourUsd)}/hour
                        </span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 bg-gold/10 px-4 py-3 text-sm">
                        <span className="font-medium text-white">
                          {ready.employees} × {ready.hoursPerWeek} × {ready.ratePerHourUsd} ×{" "}
                          {ROBOTICS_WEEKS_PER_YEAR}
                        </span>
                        <span className="font-mono font-semibold text-gold">
                          {formatRoboticsUsd(ready.annualUsd)}
                        </span>
                      </div>
                    </div>

                    <p className="mt-4 text-xs leading-relaxed text-gray-500">
                      Planning estimate from your taps and a published-style {formatRoboticsUsd(ROBOTICS_RATE_PER_HOUR_USD)}/hour
                      footage rate. Not an offer, quote, or promise of payment. Real terms depend on the
                      program and what footage is accepted.
                    </p>

                    <div className="mt-8">
                      <a
                        href={BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cta-gold inline-flex min-h-[56px] w-full items-center justify-between gap-4 rounded-xl px-6 text-left text-base font-semibold sm:w-auto sm:min-w-[20rem]"
                      >
                        <span>Book a call about this estimate</span>
                        <span aria-hidden className="text-xl">↗</span>
                      </a>
                    </div>

                    {ready.industry.archiveBridge && (
                      <div className="mt-8 border border-gold/30 bg-gold/[0.06] p-5">
                        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold/80">
                          Also worth a look
                        </p>
                        <p className="mt-3 text-base font-medium text-white">
                          Trades businesses often hold project files, photos, schedules, and system exports
                          that AI data partners license separately.
                        </p>
                        <Link
                          href={LICENSE_HREF}
                          className="mt-5 inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-[0.18em] text-gold underline-offset-4 hover:underline"
                        >
                          See what those records could be worth →
                        </Link>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => dispatch({ type: "restart" })}
                      className="mt-8 min-h-[44px] font-mono text-xs uppercase tracking-[0.2em] text-gray-400 transition hover:text-white"
                    >
                      Start over
                    </button>
                  </div>
                )}

                {state.step !== "result" && state.step !== "industry" && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "back" })}
                    disabled={state.advancing}
                    className="mt-8 min-h-[44px] font-mono text-xs uppercase tracking-[0.2em] text-gray-400 transition hover:text-white"
                  >
                    Back
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
