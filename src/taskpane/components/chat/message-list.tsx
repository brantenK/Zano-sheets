import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Loader2,
  Maximize2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type DirtyRange,
  mergeRanges,
  parseDirtyRanges,
} from "../../../lib/dirty-tracker";
import { navigateTo } from "../../../lib/excel/api";
import type { ChatMessage, MessagePart } from "../../../lib/message-utils";
import { ToolResultDisplay } from "../error-display";
import { useChat } from "./chat-context";
import { ToolProgress } from "./tool-progress";

const ThinkingBlock = memo(function ThinkingBlock({
  thinking,
  isStreaming,
}: {
  thinking: string;
  isStreaming?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="mb-2 border border-(--chat-border) bg-(--chat-bg) rounded-sm overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} reasoning`}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-(--chat-accent) hover:bg-(--chat-bg-secondary) transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={10} aria-hidden="true" />
        ) : (
          <ChevronRight size={10} aria-hidden="true" />
        )}
        <Brain size={10} aria-hidden="true" />
        thinking
        {isStreaming && <span className="animate-pulse ml-1">...</span>}
      </button>
      {isExpanded && (
        <section
          aria-label="Reasoning content"
          className="px-2 py-1.5 text-xs text-(--chat-text-muted) whitespace-pre-wrap wrap-break-word border-t border-(--chat-border) max-h-60 overflow-y-auto"
        >
          {thinking?.trim().length
            ? thinking
            : "No reasoning text was returned by the provider for this step."}
        </section>
      )}
    </div>
  );
});

type ToolCallPart = Extract<MessagePart, { type: "toolCall" }>;

type MarkdownComponentMap = {
  a?: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => ReactNode;
};

type MarkdownRendererProps = {
  children: string;
  components?: MarkdownComponentMap;
  isAnimating?: boolean;
};

const LazyStreamdown = lazy(async () => {
  const module = await import("streamdown");
  return {
    default: module.Streamdown as ComponentType<MarkdownRendererProps>,
  };
});

const DirtyRangeLink = memo(function DirtyRangeLink({
  range,
}: {
  range: DirtyRange;
}) {
  const { getSheetName } = useChat();
  const sheetName = getSheetName(range.sheetId);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const navRange = range.range === "*" ? undefined : range.range;
      navigateTo(range.sheetId, navRange).catch((err) => {
        console.error("[DirtyRange] Navigation failed:", err);
      });
    },
    [range],
  );

  if (range.sheetId < 0) {
    const label =
      range.range === "*" ? "Unknown sheet" : `Unknown!${range.range}`;
    return <span className="text-(--chat-warning-muted)">{label}</span>;
  }

  if (!sheetName) {
    return null;
  }

  const label =
    range.range === "*" ? `${sheetName} (all)` : `${sheetName}!${range.range}`;

  return (
    <button
      type="button"
      className="text-(--chat-warning) hover:underline cursor-pointer"
      onClick={handleClick}
    >
      {label}
    </button>
  );
});

const DirtyRangeLinks = memo(function DirtyRangeLinks({
  ranges,
}: {
  ranges: DirtyRange[];
}) {
  const { getSheetName } = useChat();
  const merged = useMemo(() => mergeRanges(ranges), [ranges]);

  const validRanges = useMemo(
    () => merged.filter((r) => r.sheetId < 0 || getSheetName(r.sheetId)),
    [merged, getSheetName],
  );

  if (validRanges.length === 0) return null;

  return (
    <>
      {validRanges.map((r, i) => (
        <span key={`${r.sheetId}-${r.range}`}>
          {i > 0 && <span className="text-(--chat-warning-muted)">, </span>}
          <DirtyRangeLink range={r} />
        </span>
      ))}
    </>
  );
});

const DirtyRangeSummary = memo(function DirtyRangeSummary({
  ranges,
}: {
  ranges: DirtyRange[];
}) {
  const { getSheetName } = useChat();
  const merged = useMemo(() => mergeRanges(ranges), [ranges]);

  const formatBrief = useCallback(
    (range: DirtyRange): string | null => {
      if (range.sheetId < 0)
        return range.range === "*" ? "unknown" : range.range;
      const sheetName = getSheetName(range.sheetId);
      if (!sheetName) return null;
      if (range.range === "*") return sheetName;
      return `${range.range}`;
    },
    [getSheetName],
  );

  const validRanges = useMemo(
    () => merged.filter((r) => r.sheetId < 0 || getSheetName(r.sheetId)),
    [merged, getSheetName],
  );

  if (merged.length === 0) return null;

  if (merged.length === 1) {
    const brief = formatBrief(merged[0]);
    if (!brief) return null;
    return (
      <span className="text-[10px] text-(--chat-warning) truncate">
        → {brief}
      </span>
    );
  }

  if (validRanges.length === 0) return null;

  return (
    <span className="text-[10px] text-(--chat-warning)">
      → {validRanges.length} ranges
    </span>
  );
});

const ToolCallBlock = memo(function ToolCallBlock({
  part,
}: {
  part: ToolCallPart;
}) {
  const { getSheetName } = useChat();
  const [isExpanded, setIsExpanded] = useState(false);
  const explanation = (part.args as { explanation?: string })?.explanation;

  const dirtyRanges = useMemo(
    () => parseDirtyRanges(part.result),
    [part.result],
  );
  const hasValidDirtyRanges = useMemo(() => {
    if (!dirtyRanges || dirtyRanges.length === 0) return false;
    return dirtyRanges.some((r) => r.sheetId < 0 || getSheetName(r.sheetId));
  }, [dirtyRanges, getSheetName]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const statusIcon = useMemo(
    () =>
      ({
        pending: (
          <CheckCircle2
            size={10}
            className="text-(--chat-accent)"
            aria-hidden="true"
          />
        ),
        running: (
          <Loader2
            size={10}
            className="animate-spin text-(--chat-accent)"
            aria-hidden="true"
          />
        ),
        complete: (
          <CheckCircle2
            size={10}
            className="text-green-500"
            aria-hidden="true"
          />
        ),
        error: (
          <XCircle size={10} className="text-red-500" aria-hidden="true" />
        ),
      })[part.status],
    [part.status],
  );

  const statusLabel = useMemo(
    () =>
      ({
        pending: "Pending",
        running: "Running",
        complete: "Complete",
        error: "Error",
      })[part.status],
    [part.status],
  );

  return (
    <div
      className={`mt-3 mb-2 border rounded-sm overflow-hidden transition-colors border-(--chat-border) bg-(--chat-bg)`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${explanation || part.name} - Status: ${statusLabel}`}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-[10px] tracking-wider text-(--chat-text-secondary) hover:bg-(--chat-bg-secondary) transition-colors ${explanation ? "normal-case" : "uppercase"}`}
      >
        {isExpanded ? (
          <ChevronDown size={10} aria-hidden="true" />
        ) : (
          <ChevronRight size={10} aria-hidden="true" />
        )}
        <Wrench size={10} aria-hidden="true" />
        <span className="flex-1 text-left font-medium truncate">
          {explanation || part.name}
        </span>
        {hasValidDirtyRanges && !isExpanded && (
          <span
            className="flex items-center gap-1.5 text-(--chat-warning) shrink-0"
            title="Modified cells"
          >
            <Edit3 size={9} aria-hidden="true" />
            <DirtyRangeSummary ranges={dirtyRanges ?? []} />
          </span>
        )}
        <span className="sr-only">{statusLabel}</span>
        {statusIcon}
      </button>
      {isExpanded && (
        <section
          aria-label={`${explanation || part.name} details`}
          className="border-t border-(--chat-border)"
        >
          {hasValidDirtyRanges && (
            <div className="px-2 py-1 text-[10px] bg-(--chat-warning-bg) text-(--chat-warning) flex items-center gap-1 flex-wrap">
              <Edit3 size={9} className="shrink-0" aria-hidden="true" />
              <span className="shrink-0">Modified:</span>
              <DirtyRangeLinks ranges={dirtyRanges ?? []} />
            </div>
          )}
          <div className="px-2 py-1.5 text-xs">
            <div className="text-(--chat-text-muted) text-[10px] uppercase mb-1">
              args
            </div>
            <div className="markdown-content max-h-32 overflow-y-auto **:data-[streamdown=code-block]:my-0 **:data-[streamdown=code-block]:border-0">
              <DeferredMarkdown
                text={`\`\`\`json
${JSON.stringify(part.args, null, 2)}
\`\`\``}
              />
            </div>
          </div>
          {part.images && part.images.length > 0 && (
            <div className="px-2 py-1.5 border-t border-(--chat-border)">
              {part.images.map((img, imgIdx) => (
                <img
                  key={`${part.id}-img-${imgIdx}`}
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={`Tool result ${imgIdx + 1}`}
                  className="max-w-full rounded-sm border border-(--chat-border)"
                />
              ))}
            </div>
          )}
          {part.result && (
            <div className="px-2 py-1.5 text-xs border-t border-(--chat-border)">
              <ToolResultDisplay
                result={part.result}
                status={
                  part.status === "error"
                    ? "error"
                    : part.status === "complete"
                      ? "success"
                      : "running"
                }
                toolName={explanation || part.name}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
});

function parseCitationUri(
  href: string,
): { sheetId: number; range?: string } | null {
  if (!href.startsWith("#cite:")) return null;
  const path = href.slice("#cite:".length);
  const bangIdx = path.indexOf("!");
  if (bangIdx === -1) {
    const sheetId = Number.parseInt(path, 10);
    return Number.isNaN(sheetId) ? null : { sheetId };
  }
  const sheetId = Number.parseInt(path.slice(0, bangIdx), 10);
  const range = path.slice(bangIdx + 1);
  return Number.isNaN(sheetId) ? null : { sheetId, range };
}

const CitationLink = memo(function CitationLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const citation = href ? parseCitationUri(href) : null;

  const handleClick = useCallback(() => {
    if (citation) {
      navigateTo(citation.sheetId, citation.range).catch((err) => {
        console.error("[Citation] Navigation failed:", err);
      });
    }
  }, [citation]);

  if (!citation) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="text-(--chat-accent) hover:underline cursor-pointer"
      onClick={handleClick}
    >
      {children}
    </button>
  );
});

const markdownComponents: MarkdownComponentMap = { a: CitationLink };

const MarkdownFallback = memo(function MarkdownFallback({
  text,
}: {
  text: string;
}) {
  return <div className="whitespace-pre-wrap break-words">{text}</div>;
});

const DeferredMarkdown = memo(function DeferredMarkdown({
  text,
  isAnimating,
  components,
}: {
  text: string;
  isAnimating?: boolean;
  components?: MarkdownComponentMap;
}) {
  return (
    <Suspense fallback={<MarkdownFallback text={text} />}>
      <LazyStreamdown components={components} isAnimating={isAnimating}>
        {text}
      </LazyStreamdown>
    </Suspense>
  );
});

const MarkdownContent = memo(function MarkdownContent({
  text,
  isAnimating,
}: {
  text: string;
  isAnimating?: boolean;
}) {
  return (
    <div className="markdown-content">
      <DeferredMarkdown
        text={text}
        components={markdownComponents}
        isAnimating={isAnimating}
      />
    </div>
  );
});

function renderParts(
  parts: MessagePart[],
  isStreaming: boolean,
  messageId: string,
) {
  const lastPart = parts[parts.length - 1];
  const isStreamingThinking = isStreaming && lastPart?.type === "thinking";
  const isStreamingText = isStreaming && lastPart?.type === "text";

  return parts.map((part, idx) => {
    const isLastPart = idx === parts.length - 1;
    // Use a stable key that includes the message ID and type to prevent unmounting
    const key =
      part.type === "toolCall" ? part.id : `${messageId}-${part.type}-${idx}`;

    if (part.type === "thinking") {
      const hasThinkingText = part.thinking.trim().length > 0;
      if (!hasThinkingText && !(isStreamingThinking && isLastPart)) {
        return null;
      }
      return (
        <ThinkingBlock
          key={key}
          thinking={part.thinking}
          isStreaming={isStreamingThinking && isLastPart}
        />
      );
    }
    if (part.type === "toolCall") {
      return <ToolCallBlock key={key} part={part} />;
    }
    return (
      <MarkdownContent
        key={key}
        text={part.text}
        isAnimating={isStreamingText && isLastPart}
      />
    );
  });
}

const UserBubble = memo(function UserBubble({
  message,
}: {
  message: ChatMessage;
}) {
  return (
    <section
      aria-label="Your message"
      className="ml-8 px-3 py-2 text-sm leading-relaxed bg-(--chat-user-bg) border border-(--chat-border)"
      style={{
        borderRadius: "var(--chat-radius)",
        fontFamily: "var(--chat-font-mono)",
      }}
    >
      {renderParts(message.parts, false, message.id)}
    </section>
  );
});
const FullScreenModal = memo(function FullScreenModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Expanded message view"
      className="fixed inset-0 bg-(--chat-bg) z-[10000] flex flex-col animate-slide-in"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-(--chat-border) bg-(--chat-bg-secondary)">
        <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) font-bold">
          Expanded View
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close expanded view"
          className="p-1 text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-6 select-text">{children}</div>
    </div>
  );
});

const AssistantBubble = memo(function AssistantBubble({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const allParts = useMemo(() => {
    const parts: { part: MessagePart; messageId: string; isLast: boolean }[] =
      [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLastMessage = i === messages.length - 1;
      for (let j = 0; j < msg.parts.length; j++) {
        parts.push({
          part: msg.parts[j],
          messageId: msg.id,
          isLast: isLastMessage && j === msg.parts.length - 1,
        });
      }
    }
    return parts;
  }, [messages]);

  const handleCloseFullScreen = useCallback(() => {
    setIsFullScreen(false);
  }, []);

  const handleOpenFullScreen = useCallback(() => {
    setIsFullScreen(true);
  }, []);

  const content = useMemo(
    () => (
      <>
        {allParts.map(({ part, messageId, isLast }, idx) => {
          const key =
            part.type === "toolCall"
              ? part.id
              : `${messageId}-${part.type}-${idx}`;
          if (part.type === "thinking") {
            return (
              <ThinkingBlock
                key={key}
                thinking={part.thinking}
                isStreaming={isStreaming && isLast}
              />
            );
          }
          if (part.type === "toolCall") {
            return <ToolCallBlock key={key} part={part} />;
          }
          return (
            <MarkdownContent
              key={key}
              text={part.text}
              isAnimating={isStreaming && isLast && part.type === "text"}
            />
          );
        })}
        {isStreaming && allParts.length === 0 && (
          <span className="animate-pulse" aria-hidden="true">
            ▊
          </span>
        )}
      </>
    ),
    [allParts, isStreaming],
  );

  return (
    <section
      aria-label={
        isStreaming ? "Assistant response - streaming" : "Assistant response"
      }
      aria-busy={isStreaming}
      className="text-sm leading-relaxed relative group"
      style={{ fontFamily: "var(--chat-font-mono)" }}
    >
      {!isStreaming && allParts.length > 0 && (
        <button
          type="button"
          onClick={handleOpenFullScreen}
          aria-label="Expand message"
          className="absolute -right-2 -top-2 p-1.5 bg-(--chat-bg) border border-(--chat-border) rounded-full shadow-sm
                     opacity-0 group-hover:opacity-100 hover:text-(--chat-accent) transition-all z-10"
        >
          <Maximize2 size={10} aria-hidden="true" />
        </button>
      )}

      {content}

      {isFullScreen && (
        <FullScreenModal onClose={handleCloseFullScreen}>
          <div className="max-w-3xl mx-auto">{content}</div>
        </FullScreenModal>
      )}
    </section>
  );
});

type MessageGroup =
  | { type: "user"; message: ChatMessage }
  | { type: "assistant"; messages: ChatMessage[] };

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentAssistantGroup: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      if (currentAssistantGroup.length > 0) {
        groups.push({ type: "assistant", messages: currentAssistantGroup });
        currentAssistantGroup = [];
      }
      groups.push({ type: "user", message: msg });
    } else {
      currentAssistantGroup.push(msg);
    }
  }

  if (currentAssistantGroup.length > 0) {
    groups.push({ type: "assistant", messages: currentAssistantGroup });
  }

  return groups;
}

const MessageList = memo(function MessageList() {
  const { state } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 100;
  }, []);

  useEffect(() => {
    if (containerRef.current && shouldAutoScroll.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  });

  // Get tool calls from the last assistant message for progress tracking
  const lastAssistantMessage = useMemo(
    () => state.messages.filter((m) => m.role === "assistant").pop(),
    [state.messages],
  );

  const toolCalls = useMemo(
    () =>
      lastAssistantMessage?.parts.filter(
        (p): p is Extract<MessagePart, { type: "toolCall" }> =>
          p.type === "toolCall",
      ) ?? [],
    [lastAssistantMessage],
  );

  // Find currently running tool index
  const currentToolIndex = useMemo(
    () => toolCalls.findIndex((t) => t.status === "running"),
    [toolCalls],
  );

  const groups = useMemo(() => groupMessages(state.messages), [state.messages]);

  const lastGroup = useMemo(() => groups[groups.length - 1], [groups]);

  const isStreamingAssistant = useMemo(
    () => state.isStreaming && lastGroup?.type === "assistant",
    [state.isStreaming, lastGroup],
  );

  if (state.messages.length === 0) {
    return (
      <section
        id="message-list"
        aria-label="Messages"
        className="flex-1 flex flex-col items-center justify-center p-6 text-center"
        style={{ fontFamily: "var(--chat-font-mono)" }}
      >
        <div className="text-(--chat-text-muted) text-xs uppercase tracking-widest mb-2">
          no messages
        </div>
        <div className="text-(--chat-text-secondary) text-sm max-w-[200px]">
          Start a conversation to interact with your Excel data
        </div>
      </section>
    );
  }

  return (
    <section
      id="message-list"
      ref={containerRef}
      onScroll={handleScroll}
      aria-label="Chat messages"
      aria-live="polite"
      aria-busy={state.isStreaming}
      className="flex-1 overflow-y-auto p-3 space-y-3"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "var(--chat-scrollbar) transparent",
      }}
    >
      {groups.map((group, i) => {
        if (group.type === "user") {
          return <UserBubble key={group.message.id} message={group.message} />;
        }
        const groupKey = group.messages.map((m) => m.id).join("-");
        return (
          <AssistantBubble
            key={groupKey}
            messages={group.messages}
            isStreaming={isStreamingAssistant && i === groups.length - 1}
          />
        );
      })}
      {/* Show tool progress when tools are running */}
      {state.isStreaming && currentToolIndex >= 0 && toolCalls.length > 0 && (
        <ToolProgress
          tools={toolCalls}
          currentIndex={currentToolIndex}
          startTime={state.sessionStats.streamingStartTime}
        />
      )}
    </section>
  );
});

export default MessageList;
