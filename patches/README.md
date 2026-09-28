# Arc public-RPC compatibility patch

Pinned to Ponder 0.17.8. Run `pnpm check` after any Ponder upgrade; do not silently
drop the patch or raise the request rate to compensate for unrelated logs.

For chain 5042 only, the real-time bloom check uses known factory children when
the exact parent hash and consecutive block number have already been reconciled.
Factory registration blooms always request logs, including registration and
trading in the same block. Unknown child coverage and speculative/reorg heads
retain Ponder's original conservative behavior. Empty blooms retain its existing
RPC verification. Block hash, receipt and log validations are unchanged.

Missing block headers are still prefetched, but event fetching/reconciliation
is ordered, so a new child in block N is known before filtering N+1. This avoids
the unsafe shortcut of filtering a whole prefetched batch using a stale map.
Tests exercise the installed runtime, including registration, gap batches and
reorg rollback. Other chain IDs retain the upstream prefetch path.

`src/public-rpc.ts` separately serializes requests with >=300ms between starts,
a shared 5–30s exponential cooldown after throttling, and bounded queue pressure.
Ponder remains responsible for retries; failed RPC calls never become empty logs.
Minute-level cumulative counters log method names/counts, not URLs or payloads.
The interval is an application limit, not a claim about Arc's published quota.
