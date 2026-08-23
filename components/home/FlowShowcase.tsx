import Link from "next/link";
import { WorkflowFlow } from "@/components/WorkflowFlow";

export function FlowShowcase() {
  return (
    <section className="section-light border-t border-gray-200">
      <div className="mx-auto max-w-[1400px] px-6 py-16 sm:py-20 lg:px-10 lg:py-28">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="section-label mb-6">In practice</p>
            <h2 className="headline-sm">
              What an automated workflow actually looks like.
            </h2>
          </div>
          <Link href="/solutions" className="link-arrow shrink-0 text-black">
            Explore use cases
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="mt-14 space-y-14">
          <WorkflowFlow
            title="Construction — OAC meeting to executive brief"
            steps={[
              "OAC meeting ends",
              "Actions extracted",
              "Procore cross-check",
              "Open issues flagged",
              "PM review",
              "Executive brief",
            ]}
            caption="Commitments and schedule concerns leave the meeting record already assigned — before the next meeting, not after."
          />
          <WorkflowFlow
            title="Property management — resident request to resolution"
            steps={[
              "Resident submits issue",
              "AI categorizes + routes",
              "Work order created",
              "Resident acknowledged",
              "Resolution tracked",
              "Overdue escalated",
            ]}
            caption="High-volume resident communication becomes a managed queue — with sensitive matters escalated to staff."
          />
        </div>
      </div>
    </section>
  );
}
