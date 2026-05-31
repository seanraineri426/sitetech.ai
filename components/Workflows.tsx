const featuredWorkflows = [
  {
    tag: "Development",
    title: "Meeting command center",
    problem:
      "Critical decisions happen in OAC meetings, lender calls, consultant calls, and owner updates, then fragment across notes, emails, and memory.",
    system:
      "Meeting agents transcribe, summarize, detect decisions, assign action owners, flag schedule and budget implications, and write the record back to the project ledger.",
    decision:
      "What changed, who owns it, when it is due, and what project assumption it touches.",
    capabilities: [
      "Contextual minutes",
      "Action owner routing",
      "Decision ledger",
      "Schedule and budget impact detection",
    ],
  },
  {
    tag: "Construction",
    title: "Visual progress intelligence",
    problem:
      "The field and office rarely share the same view of work in place, open constraints, and what changed since the last look-ahead.",
    system:
      "Vision agents review camera, drone, and photo capture against scopes, drawings, and look-aheads, then generate daily progress intelligence for the team.",
    decision:
      "Which scopes moved, which did not, where evidence exists, and what should be escalated.",
    capabilities: [
      "Camera and drone review",
      "Scope-level progress notes",
      "Variance detection",
      "Evidence-linked reporting",
    ],
  },
  {
    tag: "Brokerage",
    title: "Parcel intelligence network",
    problem:
      "Market opportunity is hidden across zoning maps, ownership records, tax data, comps, sale history, aerials, and local knowledge.",
    system:
      "Market agents maintain a parcel-level intelligence map, estimate build potential, surface owner context, and rank sites against your product thesis.",
    decision:
      "Which parcels deserve attention now, why they fit, and what the first owner conversation should be.",
    capabilities: [
      "Parcel tracking",
      "Zoning and ownership context",
      "Massing estimates",
      "Ranked opportunity lists",
    ],
  },
  {
    tag: "Appraisal",
    title: "Valuation evidence engine",
    problem:
      "Appraisers spend hours pulling comparables, building adjustment grids, verifying property facts, and drafting narrative, repeating the same manual work on every assignment.",
    system:
      "Valuation agents assemble candidate comparables, draft adjustment grids with documented rationale, organize the approaches to value, and generate narrative sections grounded in source data and your report templates.",
    decision:
      "Which comparables support the opinion of value, how each adjustment is justified, and where the report still needs appraiser review.",
    capabilities: [
      "Comparable selection and ranking",
      "Adjustment grid drafts with rationale",
      "Approach reconciliation support",
      "USPAP-aware narrative drafts",
    ],
  },
];

const workflowGroups = [
  {
    sector: "Real Estate Development",
    description:
      "Agentic systems for the work between site control, entitlement, capitalization, construction, and delivery.",
    items: [
      {
        title: "Entitlement tracker",
        agent: "Reads hearing calendars, municipal portals, consultant updates, and approval letters.",
        outcome: "Designed to prevent missed deadlines and show the next approval path.",
      },
      {
        title: "Budget variance analyst",
        agent: "Compares budget, commitments, invoices, change orders, and forecast assumptions.",
        outcome: "Designed to surface budget movement before the monthly reporting cycle.",
      },
      {
        title: "Schedule risk agent",
        agent: "Monitors look-aheads, meeting notes, RFIs, procurement dates, and critical path assumptions.",
        outcome: "Designed to flag activities that threaten delivery dates.",
      },
      {
        title: "Capital partner reporting",
        agent: "Drafts lender and investor updates from project controls, site evidence, and financial records.",
        outcome: "Designed to reduce manual reporting work and keep updates consistent.",
      },
      {
        title: "Consultant coordination",
        agent: "Tracks open items across architect, civil, zoning, legal, traffic, and environmental teams.",
        outcome: "Designed to keep consultant dependencies visible and assigned.",
      },
    ],
  },
  {
    sector: "General Construction",
    description:
      "AI workflows for field capture, project controls, document control, cost control, and trade coordination.",
    items: [
      {
        title: "RFI and submittal control",
        agent: "Reads Procore, email, specs, drawings, and meeting notes to identify stuck items.",
        outcome: "Designed to close loops before document delays hit the field.",
      },
      {
        title: "Bid leveling copilot",
        agent: "Extracts scope, alternates, exclusions, qualifications, and unit costs from subcontractor bids.",
        outcome: "Designed to make bid comparisons faster and more consistent.",
      },
      {
        title: "Change order triage",
        agent: "Links field events, RFIs, drawings, photos, and cost impacts into a claim-ready packet.",
        outcome: "Designed to clarify what changed, why, and who needs to approve it.",
      },
      {
        title: "Pay app reconciliation",
        agent: "Compares pay apps against contracts, stored materials, lien waivers, and progress evidence.",
        outcome: "Designed to catch mismatches before payment approval.",
      },
      {
        title: "Safety observation assistant",
        agent: "Reviews photos, reports, and inspection notes for repeat conditions and missing follow-up.",
        outcome: "Designed to route safety issues to responsible teams with evidence attached.",
      },
    ],
  },
  {
    sector: "Real Estate Brokerage",
    description:
      "AI agents for sourcing, research, outreach, transaction management, and market intelligence.",
    items: [
      {
        title: "Owner outreach agent",
        agent: "Combines parcel data, ownership history, sale signals, and product fit into targeted outreach.",
        outcome: "Designed to give brokers a sharper reason to call.",
      },
      {
        title: "Comp set builder",
        agent: "Pulls sales, listings, rent comps, construction comps, and location context into a defensible set.",
        outcome: "Designed to reduce time spent building market support.",
      },
      {
        title: "Listing packet generator",
        agent: "Drafts teasers, broker opinions, property summaries, and buyer lists from source materials.",
        outcome: "Designed to turn raw deal files into market-ready materials.",
      },
      {
        title: "CRM enrichment",
        agent: "Reads email, calls, notes, documents, and public data to keep contacts and deal status current.",
        outcome: "Designed to reduce dead records and missed follow-up.",
      },
      {
        title: "Pipeline prioritization",
        agent: "Ranks prospects by timing, owner profile, product fit, market movement, and relationship history.",
        outcome: "Designed to focus the team on deals worth immediate attention.",
      },
    ],
  },
  {
    sector: "Private Equity Real Estate",
    description:
      "Controlled AI systems for acquisitions, diligence, asset management, portfolio operations, and reporting.",
    items: [
      {
        title: "Diligence room analyst",
        agent: "Extracts risks from leases, debt docs, environmental reports, surveys, service contracts, and capex files.",
        outcome: "Designed to accelerate first-pass diligence without losing source traceability.",
      },
      {
        title: "Underwriting model assistant",
        agent: "Reads assumptions, rent rolls, comps, lease terms, debt terms, and sensitivity cases.",
        outcome: "Designed to identify assumption gaps and draft investment committee support.",
      },
      {
        title: "Portfolio operating cockpit",
        agent: "Unifies asset KPIs, leasing activity, capex, debt, valuation, and operating plans.",
        outcome: "Designed to show where management attention is needed first.",
      },
      {
        title: "Covenant monitor",
        agent: "Checks loan terms, reporting requirements, DSCR, reserves, maturities, and notice dates.",
        outcome: "Designed to reduce covenant and reporting surprises.",
      },
      {
        title: "LP reporting engine",
        agent: "Drafts investor narratives from asset updates, financials, capital events, and valuation changes.",
        outcome: "Designed to make reporting faster while keeping numbers tied to source records.",
      },
    ],
  },
  {
    sector: "Real Estate Appraisal",
    description:
      "Agentic systems for valuation research, comparable analysis, report drafting, and quality control, with the appraiser in control of every professional judgment.",
    items: [
      {
        title: "Comparable analysis agent",
        agent: "Searches MLS, public records, and prior files for candidate comps, then ranks them by similarity, recency, and proximity.",
        outcome: "Designed to surface defensible comparables faster while leaving final selection to the appraiser.",
      },
      {
        title: "Adjustment grid drafter",
        agent: "Proposes line-item adjustments for size, condition, location, and amenities with documented rationale.",
        outcome: "Designed to speed grid preparation while keeping every adjustment justifiable.",
      },
      {
        title: "Property data extractor",
        agent: "Pulls subject and comp facts from public records, MLS, prior reports, and inspection notes into structured fields.",
        outcome: "Designed to cut manual data entry and reduce transcription errors.",
      },
      {
        title: "Market and trend analyst",
        agent: "Compiles submarket supply, absorption, days on market, and price trends for the relevant property type.",
        outcome: "Designed to support the market conditions section with current data.",
      },
      {
        title: "USPAP review agent",
        agent: "Checks reports for internal consistency, math, missing exhibits, and common compliance gaps.",
        outcome: "Designed to flag issues for appraiser review before delivery.",
      },
    ],
  },
];

export function Workflows() {
  return (
    <section id="workflows" className="section-light">
      <div className="mx-auto max-w-[1400px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="max-w-2xl">
          <p className="section-label mb-6">Use cases</p>
          <h2 className="headline-sm">
            Agentic workflows for decisions that move real assets.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-gray-600">
            Each use case connects models to a governed operational layer: projects,
            parcels, budgets, schedules, contracts, evidence, approvals, and people. The
            result is not a generic assistant. It is a workflow-specific agent with context,
            permissions, source traceability, and a defined path back into your systems.
          </p>
        </div>

        <div className="mt-16 border-t border-gray-200">
          {featuredWorkflows.map((wf, i) => (
            <article key={wf.title} className="border-b border-gray-200 py-14 lg:py-20">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-mono text-sm text-gray-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">
                  {wf.tag}
                </span>
              </div>

              <h3 className="mt-6 max-w-3xl text-2xl font-medium tracking-tight lg:text-4xl">
                {wf.title}
              </h3>

              <div className="mt-10 grid gap-px border border-gray-200 bg-gray-200 lg:grid-cols-3">
                {[
                  { label: "Operational problem", body: wf.problem },
                  { label: "Agentic system", body: wf.system },
                  { label: "Decision supported", body: wf.decision },
                ].map((col) => (
                  <div key={col.label} className="flex flex-col bg-white p-8">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
                      {col.label}
                    </p>
                    <p className="mt-5 text-sm leading-relaxed text-gray-600">{col.body}</p>
                  </div>
                ))}
              </div>

              <div className="mt-px grid gap-px border-x border-b border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
                {wf.capabilities.map((cap) => (
                  <div key={cap} className="bg-white px-7 py-6 text-sm leading-relaxed text-gray-700">
                    {cap}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
            Workflow catalog
          </p>
          <div className="mt-6 space-y-12">
            {workflowGroups.map((group) => (
              <div key={group.sector}>
                <div className="grid gap-4 border-t border-gray-200 pt-8 lg:grid-cols-[0.8fr_1fr]">
                  <h3 className="text-2xl font-medium tracking-tight">{group.sector}</h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
                    {group.description}
                  </p>
                </div>

                <div className="mt-8 grid gap-px border border-gray-200 bg-gray-200 lg:grid-cols-5">
                  {group.items.map((item) => (
                    <div key={item.title} className="bg-white p-6">
                      <h4 className="text-sm font-medium tracking-tight">{item.title}</h4>
                      <p className="mt-4 text-xs leading-relaxed text-gray-500">
                        <span className="font-medium text-gray-700">Agent: </span>
                        {item.agent}
                      </p>
                      <p className="mt-4 text-xs leading-relaxed text-gray-500">
                        <span className="font-medium text-gray-700">Designed outcome: </span>
                        {item.outcome}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
