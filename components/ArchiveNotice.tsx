import Link from "next/link";

/**
 * Context banner for content retained from the earlier AI-implementation
 * business so visitors are not misled about what SiteTech offers today.
 */
export function ArchiveNotice({
  variant = "article",
  className = "",
}: {
  variant?: "article" | "index";
  className?: string;
}) {
  const subject = variant === "index" ? "These articles were" : "This article was";
  const keep = variant === "index" ? "They are kept" : "It is kept";
  return (
    <aside
      aria-label="About this content"
      className={`border border-gray-200 bg-gray-50 px-5 py-4 text-sm leading-relaxed text-gray-600 ${className}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray-500">Note</span>
      <p className="mt-2">
        {subject} published when SiteTech offered AI implementation services for real estate
        companies. {keep} for reference with the original dates and authorship. SiteTech&apos;s
        current focus is helping built-environment businesses explore AI data licensing
        introductions.{" "}
        <Link href="/" className="underline underline-offset-4 hover:text-black">
          Learn more
        </Link>
        .
      </p>
    </aside>
  );
}
