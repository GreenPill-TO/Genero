/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { QrScanModal } from "./QrScanModal";
import { describe, it, expect, vi } from "vitest";

describe("QrScanModal", () => {
  it("requests camera access on mount", () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    } as unknown as MediaStream;
    Object.assign(globalThis, {
      navigator: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
      },
    });
    render(<QrScanModal closeModal={vi.fn()} />);
    expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });
});
