const drivers = [
  {
    num: "01",
    title: "Time is interest",
    detail:
      "Every day on the construction loan accrues interest, and carry, insurance, and general conditions accrue with it. Clearing blockers and compressing the schedule reduces that cost directly, not in theory.",
  },
  {
    num: "02",
    title: "Always watching",
    detail:
      "Agents monitor budgets, schedules, field evidence, and contracts continuously, so variance and slippage surface early instead of at the next monthly reporting cycle.",
  },
  {
    num: "03",
    title: "Decisions in hours, not weeks",
    detail:
      "When the answer is ready the same day, a problem gets addressed before it compounds into a change order, a claim, or a delay that moves the whole schedule.",
  },
  {
    num: "04",
    title: "Capital you can defend",
    detail:
      "Fewer surprises and a traceable record mean steadier returns and more confidence from the lenders and investors whose capital is exposed.",
  },
];

export function FinancialCase() {
  return (
    <section className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
          <div>
            <p className="section-label mb-6">The financial case</p>
            <h2 className="headline-sm">
              Time is the most expensive input in real estate. AI is how you stop wasting it.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              A development or construction project carries cost every single day it is open,
              whether or not it moves forward. When a decision waits a week or a problem hides
              for a month, that delay is not only operational. It is interest expense, eroded
              returns, and risk that compounds quietly until it is expensive to fix.
            </p>
            <p className="mt-5 text-base leading-relaxed text-gray-600">
              AI changes the math in two ways. It keeps continuous eyes on the project so risk
              surfaces early, and it shortens the time between question and answer so the work
              keeps moving. Less idle time means less interest paid and less capital exposed.
            </p>
          </div>

          <div className="border border-gray-200 bg-gray-50 p-8 lg:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
              The mechanics
            </p>
            <div className="mt-8 space-y-6">
              <div>
                <p className="font-mono text-sm leading-relaxed text-black sm:text-base">
                  days saved <span className="text-gray-400">×</span> daily carry{" "}
                  <span className="text-gray-400">=</span> interest avoided
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  Compressing the schedule converts directly into reduced carrying cost.
                </p>
              </div>
              <div className="border-t border-gray-200 pt-6">
                <p className="font-mono text-sm leading-relaxed text-black sm:text-base">
                  caught early <span className="text-gray-400">=</span> caught cheap
                </p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  A variance found this week costs a fraction of the same variance found next
                  quarter.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {drivers.map((d) => (
            <div key={d.num} className="bg-white p-8">
              <p className="font-mono text-[11px] text-gray-400">{d.num}</p>
              <h3 className="mt-4 text-lg font-medium tracking-tight">{d.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{d.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
