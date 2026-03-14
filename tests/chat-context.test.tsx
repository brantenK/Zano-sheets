import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChat } from "../src/taskpane/components/chat/chat-context";

function Probe() {
  const ctx = useChat();
  return <span>messages:{ctx.state.messages.length}</span>;
}

describe("chat-context", () => {
  it("returns fallback context outside provider in dev mode", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(<Probe />);

    expect(screen.getByText("messages:0")).toBeTruthy();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
