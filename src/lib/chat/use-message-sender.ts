/**
 * Message sending hook.
 *
 * This hook extracts the message sending logic from chat-context.tsx,
 * handling user message creation, workbook context injection, attachment
 * processing, PDF handling hints, and streaming timeout management.
 *
 * Key responsibilities (140 lines extracted from chat-context.tsx):
 * - Validate provider configuration
 * - Create user messages
 * - Inject workbook context
 * - Process attachments and PDF hints
 * - Set up streaming timeout
 * - Handle send errors
 */

import { useCallback } from "react";
import {
  formatProviderError as formatAgentErrorMessage,
  getErrorStatus,
} from "../error-utils";
import { getWorkbookMetadata } from "../excel/api";
import { recordIntegrationTelemetry } from "../integration-telemetry";
import type { ChatMessage } from "../message-utils";
import { generateId } from "../message-utils";
import type { ProviderConfig } from "../provider-config";
import { evaluateProviderConfig } from "../provider-config";
import { beginToolApprovalTurn } from "../tool-approval";

export interface UseMessageSenderOptions {
  /** Current provider configuration */
  providerConfig: ProviderConfig | null;
  /** Pending provider configuration to apply */
  pendingConfigRef: React.MutableRefObject<ProviderConfig | null>;
  /** Agent instance */
  agentRef: React.MutableRefObject<{
    prompt: (prompt: string) => Promise<unknown>;
    abort: () => void;
  } | null>;
  /** Callback to apply provider configuration */
  applyConfig: (config: ProviderConfig) => void;
  /** Callback to update chat state */
  setState: React.Dispatch<
    React.SetStateAction<{
      messages: ChatMessage[];
      isStreaming: boolean;
      error: string | null;
      sheetNames: Record<number, string>;
      [key: string]: unknown;
    }>
  >;
  /** Ref tracking streaming state */
  isStreamingRef: React.MutableRefObject<boolean>;
  /** Ref for streaming timeout */
  streamingTimeoutRef: React.MutableRefObject<number | null>;
  /** Ref for timeout warning */
  timeoutWarningRef: React.MutableRefObject<number | null>;
  /** Ref for abort controller */
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export interface UseMessageSenderResult {
  /** Send a message to the agent */
  sendMessage: (content: string, attachments?: string[]) => Promise<void>;
}

/**
 * Hook that provides message sending functionality.
 *
 * Extracts 140 lines of message sending logic from chat-context.tsx.
 */
export function useMessageSender({
  providerConfig,
  pendingConfigRef,
  agentRef,
  applyConfig,
  setState,
  isStreamingRef,
  streamingTimeoutRef,
  timeoutWarningRef,
  abortControllerRef,
}: UseMessageSenderOptions): UseMessageSenderResult {
  const sendMessage = useCallback(
    async (content: string, attachments?: string[]) => {
      if (!providerConfig) {
        setState((prev) => ({
          ...prev,
          error: "Please configure your API key first",
        }));
        return;
      }

      const configHealth = evaluateProviderConfig(providerConfig);
      if (configHealth.blocking.length > 0) {
        setState((prev) => ({
          ...prev,
          error: configHealth.blocking[0],
        }));
        return;
      }

      if (pendingConfigRef.current) {
        applyConfig(pendingConfigRef.current);
      }
      const agent = agentRef.current;
      if (!agent) {
        setState((prev) => ({
          ...prev,
          error: "Please configure your API key first",
        }));
        return;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text: content }],
        timestamp: Date.now(),
      };

      // Reset tool-call loop breaker counters for new turn
      beginToolApprovalTurn();

      // Create fresh AbortController for this turn
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      isStreamingRef.current = true;
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isStreaming: true,
        error: null,
      }));

      try {
        let promptContent = content;
        const pdfAttachments = (attachments ?? []).filter((name) =>
          /\.pdf$/i.test(name),
        );
        try {
          const metadata = await getWorkbookMetadata();
          promptContent = `<wb_context>\n${JSON.stringify(metadata, null, 2)}\n</wb_context>\n\n${content}`;

          if (metadata.sheetsMetadata) {
            const newSheetNames: Record<number, string> = {};
            for (const sheet of metadata.sheetsMetadata) {
              newSheetNames[sheet.id] = sheet.name;
            }
            setState((prev) => ({ ...prev, sheetNames: newSheetNames }));
          }
        } catch (err) {
          console.error("[Chat] Failed to get workbook metadata:", err);
          setState((prev) => ({
            ...prev,
            error:
              prev.error ??
              "Could not read workbook context; continuing without workbook metadata.",
          }));
        }

        // Add attachments section if files are uploaded
        if (attachments && attachments.length > 0) {
          const paths = attachments
            .map((name) => `/home/user/uploads/${name}`)
            .join("\n");
          promptContent = `<attachments>\n${paths}\n</attachments>\n\n${promptContent}`;
        }

        if (pdfAttachments.length > 0) {
          promptContent = `<pdf_handling_hint>\n${[
            "For uploaded PDFs used for extraction tasks, prefer image-based OCR.",
            pdfAttachments.length >= 2
              ? "If multiple invoices are attached, call prepare_invoice_batch first so you can inspect them incrementally with preview summaries and preview image paths."
              : "",
            "If the document looks like a scanned invoice, receipt, or statement, use pdf-to-images first and inspect the resulting PNG pages with read.",
            "Use pdf-to-text only when the PDF clearly has an embedded text layer or the user explicitly asks for raw text extraction.",
            pdfAttachments.length >= 4
              ? "Multiple PDFs are attached. Process them incrementally: inspect one invoice at a time, start with the first page, and only read extra pages when needed. Avoid reading all invoice pages into context at once."
              : "",
          ]
            .filter(Boolean)
            .join("\n")}\n</pdf_handling_hint>\n\n${promptContent}`;
        }

        // Set up streaming timeout (5 minutes)
        const STREAMING_TIMEOUT_MS = 5 * 60 * 1000;
        const TIMEOUT_WARNING_MS = 4 * 60 * 1000; // 4 minutes

        // Set up timeout warning at 4 minutes
        timeoutWarningRef.current = window.setTimeout(() => {
          if (isStreamingRef.current) {
            setState((prev) => ({
              ...prev,
              error:
                "This is taking longer than usual. You can wait or cancel.",
            }));
          }
        }, TIMEOUT_WARNING_MS);

        streamingTimeoutRef.current = window.setTimeout(() => {
          // Clear warning timeout
          if (timeoutWarningRef.current !== null) {
            window.clearTimeout(timeoutWarningRef.current);
            timeoutWarningRef.current = null;
          }
          console.error("[Chat] Streaming timeout reached, aborting agent");
          recordIntegrationTelemetry("stream_stall_timeout", undefined);
          // Abort the agent if it's still running
          if (isStreamingRef.current) {
            agentRef.current?.abort();
            isStreamingRef.current = false;
            streamingTimeoutRef.current = null;
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: "Request timed out after 5 minutes. Please try again.",
            }));
          }
        }, STREAMING_TIMEOUT_MS);

        await agent.prompt(promptContent);
      } catch (err) {
        // Clear streaming timeout and warning timeout on error
        if (streamingTimeoutRef.current !== null) {
          window.clearTimeout(streamingTimeoutRef.current);
          streamingTimeoutRef.current = null;
        }
        if (timeoutWarningRef.current !== null) {
          window.clearTimeout(timeoutWarningRef.current);
          timeoutWarningRef.current = null;
        }
        console.error("[Chat] sendMessage error:", err);
        recordIntegrationTelemetry("send_message_error", getErrorStatus(err));
        isStreamingRef.current = false;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: formatAgentErrorMessage(err),
        }));
      }
    },
    [
      providerConfig,
      pendingConfigRef,
      agentRef,
      applyConfig,
      setState,
      isStreamingRef,
      streamingTimeoutRef,
      timeoutWarningRef,
      abortControllerRef,
    ],
  );

  return { sendMessage };
}
