"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InquiryForm } from "@/components/data-fit/InquiryForm";

type Topic = "question" | "buyer";

function Forms() {
  const params = useSearchParams();
  const [topic, setTopic] = useState<Topic>(params.get("topic") === "buyer" ? "buyer" : "question");

  return (
    <div className="min-w-0">
      <div role="radiogroup" aria-label="What is this about?" className="mb-8 flex flex-wrap gap-2">
        {(
          [
            ["question", "I have a question"],
            ["buyer", "I am a data buyer or partner"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={topic === value}
            onClick={() => setTopic(value)}
            className={`min-h-[44px] border px-4 text-sm transition-colors ${
              topic === value
                ? "border-black bg-black font-medium text-white"
                : "border-gray-300 text-gray-700 hover:border-black"
            }`}
          >
            {topic === value ? "\u2713 " : ""}
            {label}
          </button>
        ))}
      </div>

      {topic === "question" ? (
        <InquiryForm
          key="question"
          inquiryType="process_question"
          quiz={null}
          ctaOrigin="contact-page"
          heading="Ask a question"
          allowNote
          noteLabel="Your question (optional)"
          submitLabel="Send question"
        />
      ) : (
        <InquiryForm
          key="buyer"
          inquiryType="buyer_partner"
          quiz={null}
          ctaOrigin="contact-buyer"
          heading="Start a partner conversation"
          intro="Describe your organization and the high-level categories you are interested in discussing. Please keep confidential requirements and underlying materials out of this form."
          allowNote
          noteLabel="High-level categories of interest (optional)"
          submitLabel="Start a partner conversation"
        />
      )}
    </div>
  );
}

export function ContactForms() {
  return (
    <Suspense fallback={<div className="min-h-[320px]" aria-hidden />}>
      <Forms />
    </Suspense>
  );
}
