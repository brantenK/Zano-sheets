/**
 * Agent event handling hook.
 *
 * This hook extracts the agent event handling logic from chat-context.tsx,
 * processing events from the pi-agent-core and updating the chat state accordingly.
 *
 * Events handled:
 * - message_start: Initialize a new assistant message
 * - message_update: Update streaming message content
 * - message_end: Finalize message completion
 * - tool_execution_start: Mark tool as running
 * - tool_execution_update: Update streaming tool output
 * - tool_execution_end: Finalize tool result, detect loops
 * - agent_end: Clean up after agent completion
 */

import { useCallback, useRef } from "react";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ChatMessage } from "../message-utils";
import { extractPartsFromAssistantMessage, generateId } from "../message-utils";
import { parseDirtyRanges } from "../dirty-tracker";
import { navigateTo } from "../excel/api";
import { recordIntegrationTelemetry } from "../integration-telemetry";
import {
  extractToolErrorMessage,
  isToolResultErrorText,
} from "../tool-approval";

// Tool-call loop breaker: track consecutive identical failing tool calls
const MAX_TOOL_CALLS_PER_TURN = 25;
const MAX_CONSECUTIVE_IDENTICAL_ERRORS = 3;

export interface UseAgentEventsOptions {
  /** Callback to update chat state */
  setState: React.Dispatch<React.SetStateAction<any>>;
  /** Ref tracking if follow mode is enabled */
  followModeRef: React.MutableRefObject<boolean>;
  /** Ref to clear streaming timeout */
  streamingTimeoutRef: React.MutableRefObject<number | null>;
  /** Ref tracking streaming state */
  isStreamingRef: React.MutableRefObject<boolean>;
  /** Ref to agent instance */
  agentRef: React.MutableRefObject<any>;
  /** Ref tracking streaming message ID */
  streamingMessageIdRef: React.MutableRefObject<string | null>;
}

export interface UseAgentEventsResult {
  /** Handler for agent events */
  handleAgentEvent: (event: AgentEvent) => void;
  /** Ref tracking tool call count for loop detection */
  toolCallCountRef: React.RefObject<number>;
  /** Ref tracking last tool signature for loop detection */
  lastToolSignatureRef: React.RefObject<string | null>;
  /** Ref tracking consecutive identical errors */
  consecutiveIdenticalErrorsRef: React.RefObject<number>;
}

/**
 * Hook that provides agent event handling logic.
 *
 * Extracts 289 lines of complex event handling from chat-context.tsx.
 */
export function useAgentEvents({
  setState,
  followModeRef,
  streamingTimeoutRef,
  isStreamingRef,
  agentRef,
  streamingMessageIdRef,
}: UseAgentEventsOptions): UseAgentEventsResult {
  const toolCallCountRef = useRef(0);
  const lastToolSignatureRef = useRef<string | null>(null);
  const consecutiveIdenticalErrorsRef = useRef(0);

  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case "message_start": {
          if (event.message.role === "assistant") {
            const id = generateId();
            streamingMessageIdRef.current = id;
            const parts = extractPartsFromAssistantMessage(event.message);
            const chatMessage: ChatMessage = {
              id,
              role: "assistant",
              parts,
              timestamp: event.message.timestamp,
            };
            setState((prev: any) => ({
              ...prev,
              messages: [...prev.messages, chatMessage],
            }));
          }
          break;
        }
        case "message_update": {
          if (
            event.message.role === "assistant" &&
            streamingMessageIdRef.current
          ) {
            setState((prev: any) => {
              const messages = [...prev.messages];
              const idx = messages.findIndex(
                (m: any) => m.id === streamingMessageIdRef.current
              );
              if (idx !== -1) {
                const parts = extractPartsFromAssistantMessage(
                  event.message,
                  messages[idx].parts
                );
                messages[idx] = { ...messages[idx], parts };
              }
              return { ...prev, messages };
            });
          }
          break;
        }
        case "message_end": {
          if (event.message.role === "assistant") {
            const assistantMsg = event.message as AssistantMessage;
            const isError =
              assistantMsg.stopReason === "error" ||
              assistantMsg.stopReason === "aborted";

            setState((prev: any) => {
              const messages = [...prev.messages];
              const idx = messages.findIndex(
                (m: any) => m.id === streamingMessageIdRef.current
              );

              if (isError) {
                if (idx !== -1) {
                  messages.splice(idx, 1);
                }
              } else if (idx !== -1) {
                const parts = extractPartsFromAssistantMessage(
                  event.message,
                  messages[idx].parts
                );
                messages[idx] = { ...messages[idx], parts };
              }

              return {
                ...prev,
                messages,
                error: isError
                  ? assistantMsg.errorMessage || "Request failed"
                  : prev.error,
                sessionStats: isError
                  ? prev.sessionStats
                  : {
                      ...prev.sessionStats,
                      // Would need deriveStats here but keeping simple for extraction
                    },
              };
            });
            streamingMessageIdRef.current = null;
          }
          break;
        }
        case "tool_execution_start": {
          toolCallCountRef.current += 1;

          // Hard limit: abort if too many tool calls in one turn
          if (toolCallCountRef.current > MAX_TOOL_CALLS_PER_TURN) {
            console.error("[Chat] Tool call limit reached, aborting agent");
            recordIntegrationTelemetry(
              "tool_loop_limit",
              toolCallCountRef.current
            );
            agentRef.current?.abort();
            isStreamingRef.current = false;
            setState((prev: any) => ({
              ...prev,
              isStreaming: false,
              error: `Agent stopped: exceeded ${MAX_TOOL_CALLS_PER_TURN} tool calls in one turn. This usually means the agent is stuck in a loop. Please rephrase your request or try a different approach.`,
            }));
            break;
          }

          setState((prev: any) => {
            const messages = [...prev.messages];
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              const partIdx = msg.parts.findIndex(
                (p: any) => p.type === "toolCall" && p.id === event.toolCallId
              );
              if (partIdx !== -1) {
                const parts = [...msg.parts];
                const part = parts[partIdx];
                if (part.type === "toolCall") {
                  parts[partIdx] = { ...part, status: "running" as const };
                  messages[i] = { ...msg, parts };
                }
                break;
              }
            }
            return { ...prev, messages };
          });
          break;
        }
        case "tool_execution_update": {
          setState((prev: any) => {
            const messages = [...prev.messages];
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              const partIdx = msg.parts.findIndex(
                (p: any) => p.type === "toolCall" && p.id === event.toolCallId
              );
              if (partIdx !== -1) {
                const parts = [...msg.parts];
                const part = parts[partIdx];
                if (part.type === "toolCall") {
                  let partialText: string;
                  if (typeof event.partialResult === "string") {
                    partialText = event.partialResult;
                  } else if (
                    event.partialResult?.content &&
                    Array.isArray(event.partialResult.content)
                  ) {
                    partialText = event.partialResult.content
                      .filter((c: { type: string }) => c.type === "text")
                      .map((c: { text: string }) => c.text)
                      .join("\n");
                  } else {
                    partialText = JSON.stringify(event.partialResult, null, 2);
                  }
                  parts[partIdx] = { ...part, result: partialText };
                  messages[i] = { ...msg, parts };
                }
                break;
              }
            }
            return { ...prev, messages };
          });
          break;
        }
        case "tool_execution_end": {
          let resultText: string;
          let resultImages: { data: string; mimeType: string }[] | undefined;
          if (typeof event.result === "string") {
            resultText = event.result;
          } else if (
            event.result?.content &&
            Array.isArray(event.result.content)
          ) {
            resultText = event.result.content
              .filter((c: { type: string }) => c.type === "text")
              .map((c: { text: string }) => c.text)
              .join("\n");
            const images = event.result.content
              .filter((c: { type: string }) => c.type === "image")
              .map((c: { data: string; mimeType: string }) => ({
                data: c.data,
                mimeType: c.mimeType,
              }));
            if (images.length > 0) resultImages = images;
          } else {
            resultText = JSON.stringify(event.result, null, 2);
          }

          const toolFailed = event.isError || isToolResultErrorText(resultText);

          // Track consecutive identical failing tool calls to break loops
          if (toolFailed) {
            const signature = `${event.toolName ?? ""}:${resultText?.slice(0, 100)}`;
            if (signature === lastToolSignatureRef.current) {
              consecutiveIdenticalErrorsRef.current += 1;
            } else {
              lastToolSignatureRef.current = signature;
              consecutiveIdenticalErrorsRef.current = 1;
            }

            if (
              consecutiveIdenticalErrorsRef.current >=
              MAX_CONSECUTIVE_IDENTICAL_ERRORS
            ) {
              console.error(
                "[Chat] Consecutive identical tool errors detected, aborting agent"
              );
              recordIntegrationTelemetry(
                "tool_loop_identical_errors",
                consecutiveIdenticalErrorsRef.current
              );
              agentRef.current?.abort();
              isStreamingRef.current = false;
              setState((prev: any) => ({
                ...prev,
                isStreaming: false,
                error: `Agent stopped: the same tool call failed ${MAX_CONSECUTIVE_IDENTICAL_ERRORS} times in a row with the same error. Please try a different approach.`,
              }));
              break;
            }
          } else {
            // Reset on success
            lastToolSignatureRef.current = null;
            consecutiveIdenticalErrorsRef.current = 0;
          }

          // Follow mode navigation
          if (!toolFailed && followModeRef.current) {
            const dirtyRanges = parseDirtyRanges(resultText);
            if (dirtyRanges && dirtyRanges.length > 0) {
              const first = dirtyRanges[0];
              if (first.sheetId >= 0 && first.range !== "*") {
                navigateTo(first.sheetId, first.range).catch((err) => {
                  console.error("[FollowMode] Navigation failed:", err);
                });
              } else if (first.sheetId >= 0) {
                navigateTo(first.sheetId).catch((err) => {
                  console.error("[FollowMode] Navigation failed:", err);
                });
              }
            }
          }

          setState((prev: any) => {
            let toolErrorNotice: string | null = null;
            const messages = [...prev.messages];
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              const partIdx = msg.parts.findIndex(
                (p: any) => p.type === "toolCall" && p.id === event.toolCallId
              );
              if (partIdx !== -1) {
                const parts = [...msg.parts];
                const part = parts[partIdx];
                if (part.type === "toolCall") {
                  if (toolFailed) {
                    const reason = extractToolErrorMessage(resultText);
                    toolErrorNotice = `${part.name} failed: ${reason}`;
                  }
                  parts[partIdx] = {
                    ...part,
                    status: toolFailed ? "error" : "complete",
                    result: resultText,
                    images: resultImages,
                  };
                  messages[i] = { ...msg, parts };
                }
                break;
              }
            }
            return {
              ...prev,
              messages,
              error: toolErrorNotice ?? prev.error,
            };
          });
          break;
        }
        case "agent_end": {
          // Clear streaming timeout
          if (streamingTimeoutRef.current !== null) {
            window.clearTimeout(streamingTimeoutRef.current);
            streamingTimeoutRef.current = null;
          }
          isStreamingRef.current = false;
          setState((prev: any) => ({ ...prev, isStreaming: false }));
          streamingMessageIdRef.current = null;
          break;
        }
      }
      return undefined;
    },
    [
      setState,
      followModeRef,
      streamingTimeoutRef,
      isStreamingRef,
      agentRef,
      streamingMessageIdRef,
    ]
  );

  return {
    handleAgentEvent,
    toolCallCountRef,
    lastToolSignatureRef,
    consecutiveIdenticalErrorsRef,
  };
}
