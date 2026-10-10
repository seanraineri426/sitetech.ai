import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center bg-black px-6 text-white lg:px-10">
      <div className="mx-auto w-full max-w-[1400px]">
        <p className="section-label mb-6">404</p>
        <h1 className="headline-sm max-w-2xl">This page fell between the systems.</h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-gray-400">
          The link may be old, or the page may have moved.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Link href="/" className="btn-primary">
            Back to home
          </Link>
          <Link href="/solutions" className="link-arrow text-gray-300">
            Explore solutions <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
