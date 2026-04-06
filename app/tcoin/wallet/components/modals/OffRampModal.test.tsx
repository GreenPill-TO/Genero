/** @vitest-environment jsdom */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchStampsMock = vi.hoisted(() => vi.fn());
const consoleErrorSpy = vi.hoisted(() => vi.fn());

vi.mock("cubid-sdk", () => ({
  CubidSDK: vi.fn().mockImplementation(() => ({
    fetchStamps: fetchStampsMock,
  })),
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    userData: {
      cubidData: {
        id: 123,
        cubid_id: "cubid-123",
      },
      user: {
        cubid_id: "cubid-123",
      },
    },
  }),
}));

vi.mock("@shared/hooks/useSendMoney", () => ({
  useSendMoney: () => ({
    burnMoney: vi.fn(),
    senderWallet: "0xabc",
  }),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({
    exchangeRate: 1,
    state: "ready",
    loading: false,
    error: null,
  }),
}));

vi.mock("@shared/lib/edge/redemptionsClient", () => ({
  createLegacyOfframpRequest: vi.fn(),
  createRedemptionRequest: vi.fn(),
}));

vi.mock("react-phone-input-2", () => ({
  default: ({ value, onChange, disabled }: any) => (
    <input
      aria-label="Phone number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  ),
}));

import { OffRampModal } from "./OffRampModal";

describe("OffRampModal", () => {
  beforeEach(() => {
    fetchStampsMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(consoleErrorSpy);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("falls back to manual phone entry when Cubid stamp lookup fails", async () => {
    fetchStampsMock.mockRejectedValue(new Error("Request failed with status code 404"));

    render(<OffRampModal closeModal={vi.fn()} userBalance={50} />);

    await waitFor(() => {
      expect(screen.getByText(/load your verified phone automatically/i)).toBeTruthy();
    });

    expect(screen.getByLabelText(/Phone number/i)).toBeTruthy();
  });
});
