/** @vitest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QrScanModal } from "./QrScanModal";
import { describe, expect, it, vi } from "vitest";

vi.mock("@yudiel/react-qr-scanner", () => ({
  Scanner: () => {
    React.useEffect(() => {
      navigator.mediaDevices.getUserMedia({ video: true });
    }, []);
    return <div />;
  },
}));
vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ data: { exchange_rate: 1 }, isLoading: false, error: null }),
}));

describe("QrScanModal", () => {
  it("requests camera access on mount", () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    } as unknown as MediaStream;
    Object.assign(navigator, {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
    });
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <QrScanModal closeModal={vi.fn()} />
      </QueryClientProvider>
    );
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });
});
