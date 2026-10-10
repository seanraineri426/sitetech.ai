export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string };

export type Faq = {
  question: string;
  answer: string;
};

export type RelatedLink = {
  href: string;
  label: string;
};

export type Insight = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readingTime: string;
  author: string;
  seoTitle?: string;
  faqs?: Faq[];
  related?: RelatedLink[];
  body: ContentBlock[];
};

export const insights: Insight[] = [

  {
    slug: "third-party-verification-tracking",
    title: "Third-party verifications are where affordable lease-up actually stalls",
    description:
      "Employer, asset, benefit, and landlord verifications age in inboxes while the occupancy report still looks fine. Treat them as a tracked queue with stale dates, not as a side task.",
    category: "Affordable housing",
    date: "2026-08-24",
    readingTime: "6 min read",
    author: "SiteTech AI",
    seoTitle: "LIHTC Third-Party Verification Tracking | Lease-Up Bottleneck",
    faqs: [
      { question: "What is third-party verification in affordable housing?", answer: "A request to an employer, bank, benefit agency, or prior landlord to confirm information the household cannot self-certify alone. In LIHTC and HUD files these requests often sit unanswered while the application looks 'in progress.'" },
      { question: "How should operators track outstanding verifications?", answer: "Each request needs a household, a type, a sent date, and an age. The Monday report is how many are over 10 days old, not a count of applications received." },
      { question: "Can AI send verification follow-ups on its own?", answer: "It can draft them against approved templates and flag stale items. Staff review and send. The agent does not determine whether the response is sufficient for eligibility." }
    ],
    related: [
      { href: "/blog/lease-up-command-center-monday-morning", label: "Lease-up command center" },
      { href: "/blog/recertification-is-a-queue", label: "Recertification is a queue" },
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" }
    ],
    body: [
      {
        type: "p",
        text: "Ask a leasing coordinator where a file is and you will often hear 'waiting on verification.' That phrase hides the whole operation. Waiting on which request, sent when, to whom, for which household member. Without those fields, leadership sees applications in progress and assumes lease-up is moving.",
      },
      {
        type: "p",
        text: "Third-party verifications are the slowest legal step in many LIHTC and HUD files. Employers ignore the first fax. Benefit letters lag. Prior landlords do not call back. The coordinator chases in email. The PMS still says pending. No one has a list ranked by age.",
      },
      {
        type: "h2",
        text: "The unit of work is the request, not the application",
      },
      {
        type: "p",
        text: "An application can be 'almost done' and still have three open verifications. Track each request as its own ticket.",
      },
      {
        type: "list",
        items: [
          "Household and member the request belongs to.",
          "Type: employment, asset, benefit, or landlord.",
          "Date sent, channel, and a stale threshold (ten days is a common internal flag).",
          "Status: not sent, outstanding, received, insufficient, ready for staff review.",
        ],
      },
      {
        type: "quote",
        text: "If you cannot name the oldest unanswered verification this morning, you do not have a verification process. You have hope.",
      },
      {
        type: "h2",
        text: "What an agent should do here",
      },
      {
        type: "p",
        text: "Classify incoming documents against open requests. Age anything unanswered. Draft a follow-up from an approved template. Put 'received, needs a human' in the compliance queue. Never decide that income is enough. Never send a notice that sounds like a denial.",
      },
      {
        type: "p",
        text: "That is the same command-center logic as lease-up overall, pointed at the step that actually burns calendar days. If your team is hiring occupancy coordinators while files sit on employer letters, map the verification queue first.",
      },
    ],
  },
  {
    slug: "applicant-document-collection-affordable-lease-up",
    title: "Applicant document collection is a completeness problem",
    description:
      "IDs, income, benefits, assets, and tax forms do not arrive as a packet. Income-restricted lease-up needs a required list, a state per file, and reminders staff still approve.",
    category: "Affordable housing",
    date: "2026-08-23",
    readingTime: "6 min read",
    author: "SiteTech AI",
    seoTitle: "Affordable Housing Applicant Document Collection | Lease-Up Files",
    faqs: [
      { question: "What documents are typically collected in an income-restricted lease-up?", answer: "IDs, income proofs, benefit letters, asset statements, tax forms, and program-specific affidavits. The exact list depends on LIHTC, HUD, PBV, or voucher rules and on household composition." },
      { question: "How do you keep applicants from stalling on missing documents?", answer: "A required list per household, a completeness state (complete, incomplete, awaiting verification, ready for staff), and approved reminders. Mass generic emails do not tell a household what is actually missing." },
      { question: "Should AI decide a file is complete enough to approve?", answer: "No. AI can say the required list is present and classified. A qualified person decides whether the file supports eligibility." }
    ],
    related: [
      { href: "/blog/third-party-verification-tracking", label: "Third-party verification tracking" },
      { href: "/blog/ai-should-never-determine-eligibility", label: "AI should never determine eligibility" },
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" }
    ],
    body: [
      {
        type: "p",
        text: "Market-rate leasing can survive a messy inbox. Income-restricted lease-up cannot. The household is not done when they have 'sent some stuff.' They are done when every required item for every member is classified, readable, and mapped. That is a completeness problem.",
      },
      {
        type: "p",
        text: "Most regional shops run this on email plus a shared folder plus a spreadsheet. The coordinator knows which files are close. No one else does. When that person is out, lease-up pauses.",
      },
      {
        type: "h2",
        text: "Give every application a state",
      },
      {
        type: "list",
        items: [
          "Incomplete: required items still missing.",
          "Awaiting documents: household has been asked, clock is running.",
          "Awaiting verification: packet in, third parties still open.",
          "Ready for staff review: a human can open the file without hunting.",
          "In review / decided: the agent stops. Staff own the call.",
        ],
      },
      {
        type: "p",
        text: "Reminders should name the missing item, not 'please send your documents.' Draft those lines from the required list. A person hits send. Sensitive or legal wording never goes out from the model alone.",
      },
      {
        type: "quote",
        text: "A complete file is not a pile of PDFs. It is a required list with nothing left blank.",
      },
      {
        type: "h2",
        text: "Why this is the first agent to deploy",
      },
      {
        type: "p",
        text: "Document intake is high volume, repetitive, and easy to score. You can see whether classification is right. You can see whether the completeness state matches the folder. Eligibility still sits behind a gate. For a first SiteTech install, this is the workflow that pays for itself without asking compliance to give up the pen.",
      },
    ],
  },
  {
    slug: "affordable-vs-market-rate-lease-up",
    title: "Affordable lease-up is not market-rate leasing with extra paperwork",
    description:
      "Lottery, waitlist, vouchers, income verification, and recertification change the operating system. Tools built for conventional leasing miss the queue that actually determines stabilization.",
    category: "Affordable housing",
    date: "2026-08-22",
    readingTime: "5 min read",
    author: "SiteTech AI",
    seoTitle: "Affordable vs Market-Rate Lease-Up | Why LIHTC Needs Different Ops",
    faqs: [
      { question: "How is affordable housing lease-up different from market-rate?", answer: "It adds documentation, income and third-party verification, lottery or waitlist rules, voucher or PBV coordination, and a later recertification cycle. Speed still matters, but an incomplete file is not a lease." },
      { question: "Can we use the same CRM or leasing AI we use on conventional assets?", answer: "You can use the same PMS. You should not use a generic leasing bot that treats eligibility like a lead score. The file and the human decision are the product." },
      { question: "What should leadership look at during an affordable lease-up?", answer: "Completeness, verification age, agency waits, and unit readiness. Not tour volume alone." }
    ],
    related: [
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" },
      { href: "/blog/lease-up-command-center-monday-morning", label: "Lease-up command center" },
      { href: "/blog/sit-on-yardi-dont-replace-it", label: "Why we sit on Yardi and OneSite" }
    ],
    body: [
      {
        type: "p",
        text: "Conventional lease-up optimizes for speed to a signed lease. Income-restricted lease-up optimizes for a complete, defensible file that a qualified person will certify. Those are different businesses that happen to share a building.",
      },
      {
        type: "p",
        text: "If you drop a market-rate leasing stack onto a LIHTC delivery, you will get more tours and the same stuck files. The constraint was never lead volume. It was documentation, verification, and agency time.",
      },
      {
        type: "h2",
        text: "The extra work is the work",
      },
      {
        type: "list",
        items: [
          "Lottery, waitlist, and preference rules that decide who you may even process.",
          "Income and asset documentation that must be complete before a human reviews eligibility.",
          "Third-party verifications that age outside your PMS.",
          "PBV, Section 8, or other subsidy paperwork that waits on another office.",
          "A recertification cycle that starts the day they move in.",
        ],
      },
      {
        type: "quote",
        text: "Affordable lease-up is a file factory with a housing mission. Treat it like lead-gen and you will miss stabilization.",
      },
      {
        type: "h2",
        text: "Build the operating layer for the file, not the tour",
      },
      {
        type: "p",
        text: "SiteTech's first package is a lease-up command center on the tools you already use. Agents move paper and surface bottlenecks. Humans keep eligibility. That split is how you add speed without pretending LIHTC is conventional multifamily.",
      },
    ],
  },

  {
    slug: "lease-up-command-center-monday-morning",
    title: "What a lease-up command center actually looks like on Monday morning",
    description:
      "During affordable lease-up the bottleneck moves daily. Leadership does not need another spreadsheet. It needs the ten things blocking stabilization today, with the files already queued.",
    category: "Affordable housing",
    date: "2026-08-24",
    readingTime: "6 min read",
    author: "SiteTech AI",
    seoTitle: "Affordable Housing Lease-Up Command Center | Monday Workflow",
    faqs: [
      { question: "What is an affordable housing lease-up command center?", answer: "A daily exception view of what is blocking stabilization: incomplete applications, stale third-party verifications, agency waits, and unit readiness. Occupancy percent is the lagging score. The command center names the pile to work today." },
      { question: "Can AI approve LIHTC or Section 8 applicants during lease-up?", answer: "No. Agents can classify documents, age verifications, and draft staff-approved reminders. Eligibility, approval, denial, and legal notices stay with qualified humans." },
      { question: "What systems does a lease-up command center sit on?", answer: "Email, Excel or SharePoint, and the property-management system you already run (Yardi or OneSite). It overlays those tools instead of replacing them." }
    ],
    related: [
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" },
      { href: "/blog/recertification-is-a-queue", label: "Recertification is a queue problem" },
      { href: "/how-it-works", label: "How a workflow assessment works" }
    ],
    body: [
      {
        type: "p",
        text: "Income-restricted lease-up is not market-rate leasing with extra paperwork. It is documentation, third-party verification, agency coordination, and program rules, at volume, under a deadline. The work is not mysterious. It is a moving queue. What changes every morning is which part of the queue is stuck.",
      },
      {
        type: "p",
        text: "Most operators already have the pieces. Applications live in Yardi or OneSite. Missing items live in email. Verifications live in a shared drive or a leasing coordinator's head. Unit readiness lives in a construction or make-ready tracker. Monday's leadership question is simple: what is actually preventing move-ins this week? That answer is usually assembled by a person, late, from five systems.",
      },
      {
        type: "h2",
        text: "The bottleneck is not 'leasing.' It is a specific pile.",
      },
      {
        type: "p",
        text: "A useful Monday brief does not say the property is at 61 percent occupancy. It names the pile that is holding the rest of the file.",
      },
      {
        type: "list",
        items: [
          "Applications received versus applications complete enough for staff review.",
          "Households waiting on employer, asset, benefit, or landlord verifications, and how many of those requests are stale.",
          "Files waiting on the housing authority, PBV, or voucher paperwork.",
          "Units that are leased on paper but not ready, or ready but not matched to an approved household.",
          "Draft follow-ups sitting unsent because no one had time to write them.",
        ],
      },
      {
        type: "p",
        text: "That is a command center. Not a dashboard of vanity occupancy. A ranked list of exceptions, with the next action attached, so the compliance or occupancy lead spends the morning deciding, not hunting.",
      },
      {
        type: "h2",
        text: "What the morning output looks like",
      },
      {
        type: "p",
        text: "An agent sitting on email, the spreadsheet or SharePoint folder, and the property-management system can assemble a brief before the first tour. Example shape, not a client story: applications received, incomplete, awaiting third-party verification, ready for staff review, awaiting agency action, move-ins scheduled in the next fourteen days. Then one line: the top bottleneck today, and how old the worst files are.",
      },
      {
        type: "quote",
        text: "Top 10 items preventing lease-up today. That sentence is the product. Occupancy percent is the lagging score.",
      },
      {
        type: "p",
        text: "Draft reminders for missing documents and stale verifications can sit in a review queue. Staff send them. The agent does not.",
      },
      {
        type: "h2",
        text: "Where the human stays",
      },
      {
        type: "p",
        text: "Eligibility, approval, denial, and any adverse or legal notice stay with qualified people. The agent classifies documents, tracks completeness, ages verifications, and surfaces the pile. If a file is ready for a human, it says so. It does not certify the household.",
      },
      {
        type: "p",
        text: "If your team already knows which community is in lease-up and still starts Monday inside inboxes, that is the workflow to map. A twenty-minute assessment is enough to see whether a command center is real for your stack, or just a nicer report.",
      },
    ],
  },
  {
    slug: "recertification-is-a-queue",
    title: "Recertification is a queue problem, not a staffing problem",
    description:
      "Hiring another recert specialist does not fix aging verifications, missing packets, or the 60-day cliff. Treat annual recertification as a managed queue with exceptions, and keep certification in human hands.",
    category: "Affordable housing",
    date: "2026-08-20",
    readingTime: "6 min read",
    author: "SiteTech AI",
    seoTitle: "LIHTC Recertification Workflow: A Queue, Not a Staffing Problem",
    faqs: [
      { question: "Why do affordable housing recertifications fall behind?", answer: "Files sit in different states across email, spreadsheets, and the PMS. Due dates are visible. Incomplete packets, aging verifications, and unsent outreach are not, so the urgent file is whichever someone remembered." },
      { question: "Should we hire another recertification specialist?", answer: "Sometimes. A hire who walks into the same untracked queue will still drown. Treat each household as a ticket with a state, then decide whether the gap is headcount or process." },
      { question: "What can AI do on recertifications without touching eligibility?", answer: "Classify documents, flag missing items, age third-party verifications, and draft approved outreach. Certification and income determinations stay with staff." }
    ],
    related: [
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" },
      { href: "/blog/ai-should-never-determine-eligibility", label: "AI should never determine eligibility" },
      { href: "/blog/sit-on-yardi-dont-replace-it", label: "Why we sit on Yardi and OneSite" }
    ],
    body: [
      {
        type: "p",
        text: "When recertifications slip, the usual response is another coordinator. The job post writes itself: LIHTC, HUD, Section 8, Yardi or OneSite, third-party verifications, 60-day outreach. That hire can be the right move. It is rarely the whole fix. The work they walk into is still a pile of files in different states, scattered across email, Excel, and the PMS.",
      },
      {
        type: "p",
        text: "Recertification fails the way any high-volume process fails. Items age. Follow-ups are uneven. The urgent file is the one someone remembered. The quiet file becomes a finding.",
      },
      {
        type: "h2",
        text: "A recert has states. Most shops only see a due date.",
      },
      {
        type: "p",
        text: "Once you treat each household as a ticket with a state, the staffing conversation changes. You are no longer asking one person to hold the whole portfolio in their head.",
      },
      {
        type: "list",
        items: [
          "Upcoming: outreach not started, still inside the safe window.",
          "Packet requested: household contacted, documents incomplete.",
          "Submitted: documents in, not yet classified or mapped to members.",
          "Awaiting verification: employer, asset, benefit, or landlord request outstanding.",
          "Ready for staff: complete enough for a qualified reviewer.",
          "Certified: a human signed. The agent never reaches this state on its own.",
        ],
      },
      {
        type: "p",
        text: "The Monday question is not 'how many recerts are due this month.' It is '17 due within 60 days, 6 households have not submitted, 4 files are waiting on verification older than ten days.' That is a queue report. A person can work it.",
      },
      {
        type: "h2",
        text: "Why another headcount still drowns",
      },
      {
        type: "p",
        text: "A new specialist inherits the same glue work. They re-check the same mailbox. They rebuild the same tracker. They draft the same missing-document letter. When they leave, the process leaves with them. Volume did not create that fragility. The lack of a shared queue did.",
      },
      {
        type: "quote",
        text: "If the only system of record for recert status is a coordinator, you do not have a process. You have a person.",
      },
      {
        type: "h2",
        text: "What to automate, and what not to",
      },
      {
        type: "p",
        text: "Agents are good at classification, aging, and draft outreach against approved templates. They are the wrong tool for income determinations, household composition calls, and certification sign-off. Put the machine on the queue. Leave the certificate with the person who carries the compliance risk.",
      },
      {
        type: "p",
        text: "If you are hiring for recert or occupancy right now, that is a signal the queue is already overloaded. Map it before you assume the next FTE is the only lever. That is the assessment: where the file actually sits, which handoffs stall, and which exceptions a human still has to own.",
      },
    ],
  },
  {
    slug: "ai-should-never-determine-eligibility",
    title: "AI should never determine eligibility",
    description:
      "A hard product rule, not a slogan. Agents may organize files and surface exceptions. Qualified humans keep eligibility, approval, denial, and every notice that carries legal weight.",
    category: "Compliance",
    date: "2026-08-17",
    readingTime: "6 min read",
    author: "SiteTech AI",
    seoTitle: "AI and Affordable Housing Compliance: Never Determine Eligibility",
    faqs: [
      { question: "Can AI determine LIHTC or HUD eligibility?", answer: "It should not. Eligibility, approval, denial, and certification sign-off belong to qualified staff. Agents organize the file and stop before the decision." },
      { question: "What is safe to automate in affordable housing compliance?", answer: "Document collection and classification, completeness queues, verification tracking, exception reporting, and draft communications for human review." },
      { question: "How do you enforce that AI will not deny an applicant?", answer: "Least-privilege access, human approval gates on eligibility and legal notices, and a record of what was read, drafted, and sent. A policy slide is not a control." }
    ],
    related: [
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" },
      { href: "/blog/lease-up-command-center-monday-morning", label: "Lease-up command center" },
      { href: "/how-it-works", label: "How SiteTech works" }
    ],
    body: [
      {
        type: "p",
        text: "Affordable housing already has a compliance officer, a file, and a set of program rules. Adding AI does not change who is allowed to decide whether a household qualifies. If a vendor is vague about that line, they are asking you to take a risk they will not put their name on.",
      },
      {
        type: "p",
        text: "We treat it as a technical boundary, not a preference. Agents do not determine eligibility. They do not approve or deny. They do not send adverse, legal, or eligibility notices on their own. If a workflow needs one of those actions, it stops and waits for a person.",
      },
      {
        type: "h2",
        text: "What agents may do",
      },
      {
        type: "list",
        items: [
          "Collect and classify applicant or recertification documents against a required list.",
          "Map files to household members and flag what is missing.",
          "Track third-party verifications and age unanswered requests.",
          "Draft missing-document reminders and appointment notices for staff to review and send.",
          "Surface exceptions: complete enough for review, stale, or waiting on an agency.",
        ],
      },
      {
        type: "h2",
        text: "What qualified humans keep",
      },
      {
        type: "list",
        items: [
          "Eligibility and income determinations.",
          "Applicant approval, denial, and prioritization.",
          "Legal and compliance-sensitive communications.",
          "Final certification and reporting sign-off.",
        ],
      },
      {
        type: "p",
        text: "That split is the only version of 'AI for lease-up' a compliance manager should be willing to forward internally. The machine makes the file ready. The person makes the call.",
      },
      {
        type: "quote",
        text: "If the agent can say yes or no to a household, it is in the wrong layer of the system.",
      },
      {
        type: "h2",
        text: "Why the line has to be enforced, not promised",
      },
      {
        type: "p",
        text: "A policy in a slide deck is not a control. Least-privilege access, human approval gates, and a record of what was read, drafted, and sent are how the rule survives a busy Friday. The agent can prepare a summary for review. It cannot skip the reviewer because the file looks complete.",
      },
      {
        type: "p",
        text: "This is also why we do not sell a generic chatbot for occupancy. A chat window will answer the question you typed. It will not refuse the question it should not own. An operating layer can. If you want a system your compliance lead can live with, start there, not with a smarter prompt.",
      },
    ],
  },
  {
    slug: "sit-on-yardi-dont-replace-it",
    title: "Why we sit on Yardi and OneSite instead of replacing them",
    description:
      "The property-management system is not the problem. The work that dies between email, Excel, SharePoint, and the PMS is. Overlay the agents. Do not rip out the system of record.",
    category: "Operating layer",
    date: "2026-08-14",
    readingTime: "5 min read",
    author: "SiteTech AI",
    seoTitle: "Yardi and OneSite AI Overlay: Don't Replace Your PMS",
    faqs: [
      { question: "Should we replace Yardi or OneSite to add AI?", answer: "No. Those systems hold the lease, household, recert, and audit trail. The stall is usually the handoff between email, Excel, SharePoint, and the PMS." },
      { question: "What is an AI overlay on Yardi or OneSite?", answer: "Agents that read authorized data from the tools you already use, move work between them, and write back only what you allow. The PMS stays the system of record." },
      { question: "Who is this for?", answer: "Regional and mid-size operators who already run Yardi or OneSite and feel lease-up or recert volume in the gaps between systems, not national rip-and-replace buyers." }
    ],
    related: [
      { href: "/integrations", label: "Integrations" },
      { href: "/solutions/affordable-housing", label: "Affordable housing workflows" },
      { href: "/blog/lease-up-command-center-monday-morning", label: "Lease-up command center" }
    ],
    body: [
      {
        type: "p",
        text: "Regional operators did not choose Yardi or OneSite lightly. Those systems hold the lease, the household, the recert, the charge, and the audit trail. Replacing them to 'add AI' is a multi-year project dressed up as a product demo. The team still has to recertify households next month.",
      },
      {
        type: "p",
        text: "The stall is rarely inside the PMS. It is the handoff. A document lands in Outlook. Someone saves it to a drive. Someone else updates a tracker. A coordinator keys a status into Yardi two days later. No system saw the gap because no system sat across all four.",
      },
      {
        type: "h2",
        text: "Connect the stack you already run",
      },
      {
        type: "p",
        text: "An overlay reads from the tools the team already trusts and writes back only what you allow. Email and the shared drive tell you what arrived. Spreadsheets tell you what someone is tracking off to the side. Yardi or OneSite remains the system of record for the household. The agent moves work between them so a person is not the integration.",
      },
      {
        type: "list",
        items: [
          "Least-privilege access, defined up front. The agent gets the inboxes and folders the workflow needs, not the whole company.",
          "Human gates on anything that changes eligibility, money, or a legal notice.",
          "A record, where the stack allows it, of what was read, drafted, and approved.",
          "No second occupancy database you have to keep in sync.",
        ],
      },
      {
        type: "quote",
        text: "If the AI project starts with a PMS conversion, you are solving last year's problem so you can delay this year's queue.",
      },
      {
        type: "h2",
        text: "Why this fits a regional shop",
      },
      {
        type: "p",
        text: "National platforms can stand up internal tools. A 2,000-unit or 8,000-unit operator usually cannot. They have Yardi or OneSite, a few strong coordinators, and a lease-up or recert season that spikes the same way every time. They need the existing system to stay. They need the glue work off those coordinators' desks.",
      },
      {
        type: "p",
        text: "That is the assessment we run. Not a rip-and-replace pitch. A map of how a file actually moves from email to a complete record in the PMS, and an honest call on which of those steps an agent can take without touching eligibility. If your stack is already Yardi or OneSite, you are the buyer this was built for.",
      },
    ],
  },
  {
    slug: "the-chat-window-is-the-wrong-place-to-run-a-project",
    title: "The chat window is the wrong place to run a project",
    description:
      "General-purpose AI assistants are impressive in a demo and useless on a deadline. The reason is structural: they have no record of your project. Here is what real estate and construction teams actually need instead.",
    category: "Operating layer",
    date: "2026-05-12",
    readingTime: "6 min read",
    author: "SiteTech AI",
    body: [
      {
        type: "p",
        text: "Most teams meet AI through a chat box. You paste in a few paragraphs, ask a question, and get an answer that sounds confident. For a real estate developer or a general contractor, that experience is both exciting and misleading. The model is fluent, but it knows nothing about your project. It cannot tell you which RFI is blocking the slab pour, what the lender promised on the last draw, or why the schedule slipped two weeks ago.",
      },
      {
        type: "p",
        text: "The gap is not intelligence. The frontier models are already good enough to reason about a change order or a lease abstract. The gap is context and accountability. A chat window starts from zero every time, has no memory of your decisions, and leaves no trace of what it did. That is fine for drafting an email. It is the wrong foundation for running a project worth tens of millions of dollars.",
      },
      {
        type: "h2",
        text: "What the chat window is missing",
      },
      {
        type: "p",
        text: "Three things separate a clever demo from a system you can actually operate on. None of them are about the model itself.",
      },
      {
        type: "list",
        items: [
          "Context. The agent needs your projects, parcels, budgets, schedules, contracts, and field evidence available as structured, queryable state, not pasted into a prompt one document at a time.",
          "Governance. It needs to know who is allowed to see what, which actions require human approval, and where its authority ends.",
          "A record. Every read, recommendation, and write needs to be logged against a system of record, so the output is traceable back to a source and defensible months later.",
        ],
      },
      {
        type: "p",
        text: "When those three are missing, you get answers you cannot trust and cannot audit. When they are present, you get something different: an agent that works from the same ground truth as your team and leaves a clean trail behind every decision.",
      },
      {
        type: "h2",
        text: "The operating layer, not the chatbot",
      },
      {
        type: "p",
        text: "The useful unit is not a smarter chatbot. It is an operating layer that sits between the models and your business. It holds a private map of how your operation actually works, connects to the tools your team already uses, enforces your permissions, and writes results back to a ledger you control. The model becomes one interchangeable component inside that layer rather than the whole product.",
      },
      {
        type: "quote",
        text: "A model answers questions. An operating layer runs work, with context, permissions, and a record of what happened.",
      },
      {
        type: "p",
        text: "This distinction matters most when something goes wrong. If an agent flags a budget variance, you need to know which line items moved, which invoices triggered the flag, and when. If it drafts a lender update, you need every number tied back to the source record. A chat window cannot give you that. An operating layer is built around it.",
      },
      {
        type: "h2",
        text: "Why we build it this way",
      },
      {
        type: "p",
        text: "Real estate and construction run on documents, field reality, and relationships that no off-the-shelf product understands out of the box. So we do not ship a generic assistant and hope it fits. We map your operation, connect your systems, deploy agents against the workflows that matter, and keep AI engineers embedded as the work evolves. The chat window is a feature inside that system. It is not the system.",
      },
    ],
  },
  {
    slug: "reading-the-job-site-vision-agents-and-progress-you-can-trust",
    title: "Reading the job site: vision agents and progress you can trust",
    description:
      "Cameras and drones already capture the job site. The hard part is turning that footage into progress the field and office both believe. The answer is grounding vision in scope, schedule, and evidence.",
    category: "Construction",
    date: "2026-04-28",
    readingTime: "7 min read",
    author: "SiteTech AI",
    body: [
      {
        type: "p",
        text: "Almost every active job site is already recorded. Fixed cameras, drone flights, and phones in every hand produce more imagery than anyone can review. The problem was never capture. It is interpretation. A photo of a wall does not tell the office whether that scope is on schedule, who installed it, or whether it matches the approved drawing.",
      },
      {
        type: "p",
        text: "This is where vision agents earn their place. Not by replacing the superintendent, but by reading the same footage against everything else the project knows: the scope of work, the look-ahead, the drawings, and the prior week. The result is a daily read on what moved, what did not, and where the evidence lives.",
      },
      {
        type: "h2",
        text: "Progress is a comparison, not a picture",
      },
      {
        type: "p",
        text: "A useful progress report is never just an image. It is a comparison between what was planned and what is observable. To make that comparison, an agent needs more than a vision model. It needs the project context to compare against.",
      },
      {
        type: "list",
        items: [
          "Scopes and activities, so observed work maps to the schedule rather than to a vague impression of busyness.",
          "Drawings and specs, so installed work can be checked against what was approved.",
          "The last look-ahead, so the report describes change since the previous review instead of restating the obvious.",
          "An evidence link, so every claim about progress points back to the exact frame that supports it.",
        ],
      },
      {
        type: "p",
        text: "Without that context, computer vision produces trivia. With it, you get a progress note a project executive can act on, and one a subcontractor cannot easily dispute, because the evidence is attached.",
      },
      {
        type: "h2",
        text: "Trust comes from traceability",
      },
      {
        type: "p",
        text: "The fastest way to kill a reporting system is to let it make a claim no one can verify. If the field stops believing the report, the report is dead. So the standard we hold is simple: every statement about progress must link to the evidence behind it and write to a record that does not change quietly after the fact.",
      },
      {
        type: "quote",
        text: "If the field cannot verify the claim in one click, the report is noise. Evidence-linked or it does not ship.",
      },
      {
        type: "p",
        text: "That discipline turns a stream of footage into something the office and the field can finally share: one view of work in place, backed by evidence, updated daily, and written to a ledger both sides trust.",
      },
      {
        type: "h2",
        text: "Where the human stays in charge",
      },
      {
        type: "p",
        text: "Vision agents are good at noticing and bad at deciding. They surface what changed and what looks off. The call on whether a variance matters, whether to escalate, and what to do about it stays with the people who carry the risk. The agent makes the daily review faster and the record cleaner. It does not pretend to run the job.",
      },
    ],
  },
  {
    slug: "your-ai-gets-better-while-you-sleep",
    title: "Your AI gets better while you sleep",
    description:
      "When the underlying model improves, a well-built workflow should get sharper without a rebuild or a repurchase. That is only true if the system was designed to be model-agnostic from the start.",
    category: "Model progression",
    date: "2026-04-09",
    readingTime: "5 min read",
    author: "SiteTech AI",
    body: [
      {
        type: "p",
        text: "There is a quiet advantage to building on frontier AI that most buyers underrate. The models keep improving, and they do it on a schedule you do not control and do not pay for. A workflow that struggles with a messy lease abstract today may handle it cleanly after the next model release. The question is whether your system is built to capture that improvement or to be stranded by it.",
      },
      {
        type: "h2",
        text: "The trap of building on one model",
      },
      {
        type: "p",
        text: "Many AI products are wired tightly to a single model and a single prompt. They work, until the vendor changes the model, deprecates the version, or a better option appears that the product cannot use. The buyer is then stuck choosing between a degrading system and another rebuild. That is not compounding value. That is a treadmill.",
      },
      {
        type: "p",
        text: "The alternative is to treat the model as a component, not the foundation. The durable parts of the system are the operating layer, the context, the permissions, and the record. The model plugs into that layer and can be swapped, routed, or upgraded as the frontier moves.",
      },
      {
        type: "quote",
        text: "Build the workflow to be model-agnostic and the model becomes the part that improves for free.",
      },
      {
        type: "h2",
        text: "What model-agnostic actually buys you",
      },
      {
        type: "list",
        items: [
          "Routing. Each task can go to the model best suited to it, rather than forcing every job through one.",
          "Upgrades without rebuilds. When a stronger model ships, the same workflow can adopt it without rewriting the system around it.",
          "Continuity. If a model is deprecated or changes behavior, the workflow keeps running on the next best option.",
          "Evaluation. Because the layer owns the task and the record, you can measure whether a new model is actually better on your work before you trust it.",
        ],
      },
      {
        type: "p",
        text: "That last point matters. Newer is not automatically better for your specific task. The operating layer lets us test a candidate model against real examples from your workflow, compare the output, and only promote it when it earns the spot. The upgrade is evidence-based, not a leap of faith.",
      },
      {
        type: "h2",
        text: "Compounding, not churning",
      },
      {
        type: "p",
        text: "The goal is a system whose value curve bends up over time. The workflows you deploy this year should get more capable as the models behind them improve, while the context and trust you have built keep accruing. You buy the system once and it keeps getting better. That is the difference between an asset that compounds and a tool that churns.",
      },
    ],
  },
];

export function getInsight(slug: string): Insight | undefined {
  return insights.find((post) => post.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
