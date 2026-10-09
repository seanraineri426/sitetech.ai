# Sender Authentication (sender_auth)

## Overview

The sender authentication feature validates email authenticity using SPF, DKIM, and DMARC checks before allowing emails to create, modify, or suppress findings in the brief.

**CTO-approved feature** · **Status**: Implemented

## Configuration

Add to `project.json`:

```json
{
  "auth_mode": "warn"  // or "enforce"
}
```

### Authentication Modes

- **`warn` (default)**: Missing `sender_auth` field doesn't block verification, but runs interim display name check
- **`enforce`**: Missing or failed `sender_auth` blocks verification entirely

## Email Format

Connector must populate the optional `sender_auth` field on email records:

```json
{
  "from": {
    "name": "Dana Whitfield",
    "email": "dwhitfield@larkspurdev.example"
  },
  "subject": "Material status",
  "body_text": "...",
  "sender_auth": {
    "spf": "pass",      // "pass" | "fail" | "unknown"
    "dkim": "pass",     // "pass" | "fail" | "unknown"
    "dmarc": "pass",    // "pass" | "fail" | "unknown"
    "compauth": "pass", // "pass" | "fail" | "unknown" (composite authentication)
    "verdict": "pass"   // "pass" | "fail" | "unknown" (overall verdict)
  }
}
```

## Verification Logic

An email from a project party domain is **verified** only when:

1. `sender_auth.verdict == "pass"` (SPF/DKIM/DMARC all pass), OR
2. `sender_auth` field is missing AND `auth_mode == "warn"` AND interim check passes

### Interim Check (Warn Mode Only)

When `sender_auth` is missing but `auth_mode == "warn"`, the system runs an interim check:

- **Display name must not mention a different company**
- Example: Email from `gus.moreno@larkspurdev.example` (Larkspur Development Partners domain) with display name "Gus Moreno (Bayline Steel)" → **BLOCKED**
- This catches exact-domain spoofs with mismatched display names

## What Can Unverified Emails Do?

**Unverified emails (failed auth or failed interim check) CANNOT**:
- Create schedule slip findings
- Suppress existing findings (e.g., via delivery receipt or "received on site" facts)
- Create owner directive findings
- Create formal notice findings (these go to unverified_senders list instead)

**Unverified emails CAN**:
- Still be extracted for facts (extraction happens regardless)
- Be tracked in the `unverified_senders` list for manual review

## Migration Path

### Phase 1: Warn Mode (Current, Default)

- `auth_mode: warn` is the default
- Missing `sender_auth` field → treat as verified, run interim check
- Emails with explicit `verdict: fail` or `verdict: unknown` → unverified
- Interim check catches display name spoofs

**Result**: Existing deployments continue to work without connector changes

### Phase 2: Enforce Mode (When Connector Fills sender_auth)

Once the connector consistently populates `sender_auth`:

1. Update `project.json`: `"auth_mode": "enforce"`
2. Missing `sender_auth` field → unverified (stricter)
3. Only `verdict: pass` emails can create/suppress findings

## Testing

Run tests:

```bash
cd tools/brief-reference/evals
python3 test_sender_auth.py
```

Tests verify:
- ✓ Auth fail from owner domain can't suppress findings
- ✓ Exact-owner-domain spoof with mismatched display name can't suppress
- ✓ Genuine owner email with verdict pass works correctly
- ✓ Enforce mode blocks missing auth
- ✓ Warn mode allows missing auth with interim check

## Known Limitations

1. **Display name check is heuristic**: Matches against company name keywords, not full directory lookup
2. **No replay protection**: Same email can't be replayed (different attack vector)
3. **Domain-only in warn mode**: Display name check only catches obvious spoofs

## Future Enhancements

- Match display name against project directory contacts
- Add replay protection (nonce/timestamp validation)
- Support for delegated sending (e.g., Mailchimp on behalf of party domain)
- Log authentication warnings for security review
