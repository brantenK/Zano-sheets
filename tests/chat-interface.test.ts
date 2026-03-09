import { describe, expect, it } from "vitest";
import {
  getNextDragStateOnEnter,
  getNextDragStateOnLeave,
} from "../src/taskpane/components/chat/chat-interface";

describe("chat drag overlay state", () => {
  it("shows the overlay when dragging files into the chat", () => {
    expect(getNextDragStateOnEnter(0, true)).toEqual({
      counter: 1,
      isDragOver: true,
    });
  });

  it("keeps the overlay hidden for non-file drag events", () => {
    expect(getNextDragStateOnEnter(0, false)).toEqual({
      counter: 1,
      isDragOver: false,
    });
  });

  it("keeps the overlay visible until the last nested drag leaves", () => {
    expect(getNextDragStateOnLeave(2)).toEqual({
      counter: 1,
      isDragOver: true,
    });
    expect(getNextDragStateOnLeave(1)).toEqual({
      counter: 0,
      isDragOver: false,
    });
  });

  it("never drops the drag counter below zero", () => {
    expect(getNextDragStateOnLeave(0)).toEqual({
      counter: 0,
      isDragOver: false,
    });
  });
});