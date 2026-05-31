const tools = [
  "Procore",
  "Autodesk",
  "Yardi",
  "Salesforce",
  "SharePoint",
  "QuickBooks",
  "Sage",
  "Bluebeam",
  "HubSpot",
  "Microsoft 365",
  "Box",
  "DocuSign",
];

export function Integrations() {
  return (
    <section
      id="integrations"
      className="section-light"
      style={{ backgroundColor: "#fafafa" }}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <p className="section-label mb-6">Interoperability</p>
            <h2 className="headline-sm">
              Built to plug into the tools you already run.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-gray-600">
              We connect to your stack through its APIs and data exports instead of
              replacing it. Information can flow both ways, your system-of-record ledger
              ties it together, and your team keeps working in the software they know.
            </p>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-400">
              Examples of systems we connect to
            </p>
            <div className="mt-5 grid grid-cols-2 gap-px border border-gray-200 bg-gray-200 sm:grid-cols-3 lg:grid-cols-4">
              {tools.map((tool) => (
                <div
                  key={tool}
                  className="flex items-center justify-center bg-[#fafafa] px-4 py-8 text-center text-sm font-medium tracking-tight text-gray-700"
                >
                  {tool}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 text-sm text-gray-500">
          Don&apos;t see your system? If it has an API or exports data, we connect to it.
        </p>
        <p className="mt-4 text-xs leading-relaxed text-gray-400">
          Product names are trademarks of their respective owners, shown as integration
          targets. Their mention does not imply any partnership or endorsement.
        </p>
      </div>
    </section>
  );
}
