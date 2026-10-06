export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      <main className="flex max-w-3xl flex-col items-center gap-8 px-8 py-16 text-center">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            SiteTech
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            AI layer above construction software
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Product application — Task 1 of Milestone 1
          </p>
        </div>

        <div className="mt-8 flex gap-4">
          <a
            href="/api/health"
            className="rounded-lg border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Health Check
          </a>
        </div>
      </main>
    </div>
  );
}
