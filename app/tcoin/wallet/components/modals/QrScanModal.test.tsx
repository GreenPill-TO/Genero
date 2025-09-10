import { render } from "@testing-library/react";
import { QrScanModal } from "./QrScanModal";
import { vi } from "vitest";

describe("QrScanModal", () => {
  it("requests camera access on mount", () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    } as unknown as MediaStream;
    Object.assign(navigator, {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });
    render(<QrScanModal closeModal={vi.fn()} />);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });
});
