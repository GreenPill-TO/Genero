/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCameraAvailability } from "./useCameraAvailability";

function CameraProbe() {
  const { hasCamera, hasMultipleCameras, isCheckingCamera } = useCameraAvailability();

  return (
    <div>
      <span data-testid="has-camera">{String(hasCamera)}</span>
      <span data-testid="has-multiple-cameras">{String(hasMultipleCameras)}</span>
      <span data-testid="is-checking-camera">{String(isCheckingCamera)}</span>
    </div>
  );
}

describe("useCameraAvailability", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("reports camera presence from videoinput devices", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: "audioinput" },
          { kind: "videoinput" },
          { kind: "videoinput" },
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    render(<CameraProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("has-camera").textContent).toBe("true");
      expect(screen.getByTestId("has-multiple-cameras").textContent).toBe("true");
      expect(screen.getByTestId("is-checking-camera").textContent).toBe("false");
    });
  });

  it("falls back to no camera when mediaDevices is unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });

    render(<CameraProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("has-camera").textContent).toBe("false");
      expect(screen.getByTestId("has-multiple-cameras").textContent).toBe("false");
      expect(screen.getByTestId("is-checking-camera").textContent).toBe("false");
    });
  });
});
