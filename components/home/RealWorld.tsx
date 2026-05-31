const benefits = [
  {
    num: "01",
    title: "Grounded in reality",
    detail:
      "Agents work from your actual projects, field evidence, and documents, not a generic model guessing about your business.",
  },
  {
    num: "02",
    title: "Time back to your team",
    detail:
      "Repetitive research, reporting, and coordination run in the background so your people focus on judgment and relationships.",
  },
  {
    num: "03",
    title: "Fewer surprises",
    detail:
      "Variances, risks, and deadlines surface earlier, while there is still time to act on them.",
  },
  {
    num: "04",
    title: "Knowledge that stays",
    detail:
      "Decisions and context are captured in a ledger, so institutional knowledge does not walk out the door.",
  },
  {
    num: "05",
    title: "One source of truth",
    detail:
      "Field, office, and capital partners work from the same record instead of scattered inboxes and spreadsheets.",
  },
  {
    num: "06",
    title: "Compounds over time",
    detail:
      "As the underlying models improve, the same workflows get sharper without a rebuild or a repurchase.",
  },
];

export function RealWorld() {
  return (
    <section className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-32">
        <div className="max-w-3xl">
          <p className="section-label mb-6">Why SiteTech</p>
          <h2 className="headline-sm">
            Most AI never leaves the chat window. Real estate happens in the real world.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-gray-600">
            The name says it: technology for the site. The building, the parcel, the field,
            the deal. We take frontier AI out of the sandbox and put it to work in the
            physical, document-heavy, decision-heavy reality of real estate and construction,
            wired into the systems your team already uses. That connection to the real world
            is where the value shows up.
          </p>
        </div>

        <div className="mt-16 grid gap-px border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <div key={b.num} className="bg-white p-8 lg:p-10">
              <p className="font-mono text-[11px] text-gray-400">{b.num}</p>
              <h3 className="mt-4 text-lg font-medium tracking-tight">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{b.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
