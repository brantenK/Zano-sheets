## 2026-03-15 - Concurrent IndexedDB Transactions (N+1 bottleneck)
**Learning:** The `idb` library used for persistent storage supports queuing multiple requests concurrently within a single transaction. Awaiting `.delete()` or `.add()` sequentially in a `for...of` loop results in an N+1 bottleneck that significantly slows down operations on many files (e.g. VFS eviction, replacing skill files).
**Action:** Use `Promise.all(items.map(item => store.operation(item)))` to execute concurrent bulk operations inside IndexedDB transactions.
