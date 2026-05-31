"use client";

import { useState } from "react";

const industries = [
  {
    id: "development",
    title: "Real Estate Development",
    description:
      "From entitlement through handover, intelligence woven into how your project teams already coordinate approvals, budgets, and contractors.",
    workflows: [
      "Entitlement & approval tracking",
      "Budget vs. actuals across WBS",
      "Contractor bid leveling & RFP drafting",
      "Investor & lender reporting",
    ],
  },
  {
    id: "construction",
    title: "General Construction",
    description:
      "Field-to-office workflows that eliminate the lag between what happens on site and what your team acts on in the office.",
    workflows: [
      "RFI & submittal follow-through",
      "Field reporting to office sync",
      "Change order & COI tracking",
      "Look-ahead & schedule intelligence",
    ],
  },
  {
    id: "brokerage",
    title: "Real Estate Brokerages",
    description:
      "Pipeline intelligence that keeps your agents on deals, not on data entry, comp research, and follow-up admin.",
    workflows: [
      "Lead qualification & follow-up",
      "Comp analysis & market research",
      "Listing & transaction coordination",
      "CRM enrichment from deal docs",
    ],
  },
  {
    id: "pe",
    title: "Private Equity Real Estate",
    description:
      "Deal velocity and portfolio operations, with custom intelligence calibrated to your underwriting models and LP reporting standards.",
    workflows: [
      "Deal pipeline & diligence acceleration",
      "LP reporting & portfolio dashboards",
      "Asset management workflows",
      "Underwriting model automation",
    ],
  },
  {
    id: "appraisal",
    title: "Real Estate Appraisal",
    description:
      "Valuation workflows that handle the research, comparable analysis, and report assembly, while the appraiser keeps control of every professional judgment.",
    workflows: [
      "Comparable selection & ranking",
      "Adjustment grid drafting",
      "Market & trend analysis",
      "USPAP-aware report review",
    ],
  },
];

export function Industries() {
  const [active, setActive] = useState(industries[0].id);
  const current = industries.find((i) => i.id === active)!;

  return (
    <section id="industries" className="section-dark-solid border-t border-white/10">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="max-w-2xl">
          <p className="section-label mb-6">Industries</p>
          <h2 className="headline-sm">Built for your sector. Tuned to your process.</h2>
          <p className="body-lg mt-6">
            We don&apos;t sell a platform and ask you to adapt. We map your operations and
            build AI around them, one workflow at a time.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-[320px_1fr] lg:gap-0 lg:border lg:border-white/10">
          <div className="divide-y divide-white/10 lg:border-r lg:border-white/10">
            {industries.map((industry) => (
              <button
                key={industry.id}
                type="button"
                onClick={() => setActive(industry.id)}
                className={`group flex w-full items-center justify-between px-6 py-5 text-left transition-colors lg:px-8 lg:py-6 ${
                  active === industry.id ? "bg-white text-black" : "hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-medium tracking-tight">{industry.title}</span>
                <span
                  className={`text-sm transition-opacity ${
                    active === industry.id ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                  }`}
                >
                  →
                </span>
              </button>
            ))}
          </div>

          <div className="border border-white/10 p-8 lg:border-0 lg:p-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
              {current.id.replace("-", " ")}
            </p>
            <h3 className="mt-4 text-2xl font-medium tracking-tight">{current.title}</h3>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-400">
              {current.description}
            </p>

            <div className="mt-10 border-t border-white/10 pt-10">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-600">
                Example workflows
              </p>
              <ul className="mt-6 space-y-4">
                {current.workflows.map((workflow, i) => (
                  <li key={workflow} className="flex gap-4 text-sm text-gray-300">
                    <span className="font-mono text-gray-600">{String(i + 1).padStart(2, "0")}</span>
                    {workflow}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
