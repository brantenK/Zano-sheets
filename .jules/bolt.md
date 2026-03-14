
## 2024-03-24 - [IndexedDB Transaction Optimization]
**Learning:** Sequential `await` statements for IndexedDB deletes and adds inside a single transaction cause an N+1 bottleneck and block the execution thread sequentially for VFS files and skills.
**Action:** Always prefer `Promise.all` with mapped keys or values when doing multiple adds or deletes inside the same IndexedDB transaction to process them concurrently.
