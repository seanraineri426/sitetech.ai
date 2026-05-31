export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string };

export type Insight = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readingTime: string;
  author: string;
  body: ContentBlock[];
};

export const insights: Insight[] = [
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
