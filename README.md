# SiteTech AI

Marketing website for SiteTech AI — helping real estate and built-environment
businesses explore potential AI data licensing introductions. Referral-only:
SiteTech facilitates introductions; dataset evaluation and any licensing
transaction happen directly between the participating businesses.

The previous "AI infrastructure for real estate" site is preserved in Git —
see `docs/ORIGINAL_FRONTEND_ARCHIVE.md` and `docs/RESTORE_ORIGINAL_FRONTEND.md`.
Route changes are listed in `docs/PIVOT_ROUTE_MAP.md`.

## Development

```bash
npm install
npm run dev        # http://localhost:8000
```

## Checks

```bash
npm run typecheck  # tsc --noEmit
npm test           # node --test (quiz result logic + inquiry validation)
npm run build
npm start
```

## Where things live

- `lib/data-fit/` — the nine fit-check questions, the pure result function, result copy.
- `lib/inquiry/` — inquiry payload validation (`schema.ts`) and the delivery adapter (`submit.ts`, Web3Forms).
- `components/data-fit/` — quiz, result view, inquiry form.
- `components/home/` — homepage sections.
- `lib/site.ts` — canonical host and form-delivery configuration.

The fit check has nine questions. Team size and software are lead qualification
signals sent with the inquiry; software changes the dollar number only through the
inferred format factor, and team size does not change it. A third meter that used
to sit in the quiz HUD and reveal was removed.

Optional environment variables:

- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` overrides the committed Web3Forms access key.
- `NEXT_PUBLIC_BOOKING_URL` overrides `BOOKING_URL` in `lib/site.ts` (the "Book a
  call" link, default `https://calendly.com/sean-sitetechai/30min`).
