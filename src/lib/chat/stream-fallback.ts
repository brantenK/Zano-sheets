export function shouldScheduleStreamCompletionFallback(
  messageEnded: boolean,
  activeToolCalls: number,
): boolean {
  return messageEnded && activeToolCalls === 0;
}
