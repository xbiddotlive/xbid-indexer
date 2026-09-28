# Arc address-scoped range indexing

Pinned Ponder 0.17.8 patch. Enabled only on chain 5042 with
`PONDER_ARC_RANGE_MODE=true`; other chains retain upstream behavior.

The Arc worker continuously reuses Ponder's historical range-log pipeline instead
of entering its per-block realtime mode. Registry factory discovery runs before
child queries, including children registered inside the same range/block.
Every log request is address-scoped; large child sets stay address-filtered and
are split into Ponder's 50-address RPC chunks. The transport rejects unscoped
`eth_getLogs`, rather than falling back to whole-chain queries.

Only blocks with matched events are processed/fetched. Empty ranges advance the
existing durable checkpoint transactionally without creating synthetic blocks.
No per-block header walk is performed. Each 5s poll reads the latest header, the
prior range boundary and the new confirmed boundary (head minus Ponder's existing
30-block confirmation window). A changed confirmed boundary stops progress with
an integrity error. Unconfirmed events are deliberately not indexed. This trades
roughly 15–25 seconds of normal latency for lower public-RPC use on Arc.

Existing event decoding, receipt validation, projection transactions, crash
recovery and range caches are retained. Readiness is signalled only after the
initial confirmed checkpoint commits. The app reads PostgreSQL projections;
Ponder realtime live-query subscriptions are not used. A confirmed-boundary
integrity error requires operator recovery, not silent skipping.

`src/public-rpc.ts` separately serializes requests with >=300ms between starts,
a shared 5–30s exponential cooldown after throttling, and bounded queue pressure.
Ponder remains responsible for retries; failed RPC calls never become empty logs.
Minute-level cumulative counters log method names/counts, not URLs or payloads.
The interval is an application limit, not a claim about Arc's published quota.
Run `pnpm check` after upgrades. Tests exercise the installed runtime, including
empty ranges, boundary consistency, factory discovery and scoped query chunks.
