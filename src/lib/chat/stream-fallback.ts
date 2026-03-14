/**
 * Wraps an AsyncIterable stream with a chunk-level heartbeat timeout.
 * If no event is received within `timeoutMs`, the iterator throws a
 * timeout error so the caller can detect mid-stream stalls (e.g. silent
 * connection drops after HTTP 200).
 */
export const CHUNK_TIMEOUT_MS = 90_000;

export function withChunkHeartbeat<
  T,
  R = unknown,
  TStream extends AsyncIterable<T> & {
    result?: () => Promise<R>;
  } = AsyncIterable<T> & { result?: () => Promise<R> },
>(stream: TStream, timeoutMs: number = CHUNK_TIMEOUT_MS): TStream {
  let lastEvent: unknown = null;
  const wrapped = {
    [Symbol.asyncIterator]() {
      const iterator = stream[Symbol.asyncIterator]();
      let timerId: ReturnType<typeof setTimeout> | null = null;
      let done = false;

      function clearHeartbeat() {
        if (timerId !== null) {
          clearTimeout(timerId);
          timerId = null;
        }
      }

      function startHeartbeat(): Promise<never> {
        return new Promise<never>((_, reject) => {
          timerId = setTimeout(() => {
            reject(
              new Error(
                `Stream stalled: no data received for ${Math.round(timeoutMs / 1000)}s. The connection may have dropped.`,
              ),
            );
          }, timeoutMs);
        });
      }

      return {
        async next(): Promise<IteratorResult<T>> {
          if (done) return { done: true, value: undefined };

          try {
            const result = await Promise.race([
              iterator.next(),
              startHeartbeat(),
            ]);
            clearHeartbeat();

            if (!result.done) {
              lastEvent = result.value;
            }
            if (result.done) {
              done = true;
            }
            return result;
          } catch (err) {
            clearHeartbeat();
            done = true;
            // Fire-and-forget cleanup of the underlying iterator.
            // We don't await because the iterator may be stuck in a
            // pending promise (e.g. a stalled network read).
            try {
              iterator.return?.(undefined)?.catch?.(() => {});
            } catch {
              // ignore cleanup errors
            }
            throw err;
          }
        },
        async return(value?: unknown): Promise<IteratorResult<T>> {
          clearHeartbeat();
          done = true;
          iterator.return?.(value)?.catch?.(() => {});
          return { done: true, value: undefined };
        },
      } as AsyncIterator<T>;
    },
    result: async () => {
      if (typeof stream.result === "function") {
        return stream.result();
      }

      if (
        lastEvent &&
        typeof lastEvent === "object" &&
        "type" in (lastEvent as Record<string, unknown>)
      ) {
        const event = lastEvent as Record<string, unknown>;
        if (event.type === "done" && event.message) {
          return event.message as R;
        }
        if (event.type === "error" && event.error) {
          return event.error as R;
        }
      }

      throw new Error("Stream result unavailable");
    },
  };

  return wrapped as TStream;
}
