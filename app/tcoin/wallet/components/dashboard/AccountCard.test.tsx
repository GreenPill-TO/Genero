/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const useTokenBalanceMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ balance: "1", loading: false, error: null })
);

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: useTokenBalanceMock,
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 1 }),
}));

import { AccountCard } from "./AccountCard";

describe("AccountCard", () => {
  const originalExplorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_EXPLORER_URL = "https://env.example/address/";
    useTokenBalanceMock.mockClear();
  });

  afterEach(() => {
    if (originalExplorerUrl === undefined) {
      delete process.env.NEXT_PUBLIC_EXPLORER_URL;
    } else {
      process.env.NEXT_PUBLIC_EXPLORER_URL = originalExplorerUrl;
    }
  });

  it("builds the explorer link using NEXT_PUBLIC_EXPLORER_URL", () => {
    render(
      <AccountCard
        balance={10}
        openModal={vi.fn()}
        closeModal={vi.fn()}
        senderWallet="0xabc123"
      />
    );

    expect(useTokenBalanceMock).toHaveBeenCalledWith("0xabc123");
    const link = screen.getByRole("link", { name: /View on Explorer/i });
    expect(link.getAttribute("href")).toBe(
      "https://env.example/address/0xabc123"
    );
  });
});

