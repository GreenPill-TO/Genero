/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

const useTokenBalanceMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ balance: "1", loading: false, error: null })
);

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: useTokenBalanceMock,
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 1, state: "ready", loading: false, error: null }),
}));

import { AccountCard } from "./AccountCard";

describe("AccountCard", () => {
  beforeEach(() => {
    useTokenBalanceMock.mockClear();
  });

  it("keeps the home card focused on balance and activity", () => {
    const onOpenTransactionHistory = vi.fn();
    render(
      <AccountCard
        balance={10}
        senderWallet="0xabc123"
        onOpenTransactionHistory={onOpenTransactionHistory}
      />
    );

    expect(useTokenBalanceMock).toHaveBeenCalledWith("0xabc123");
    expect(screen.queryByRole("link", { name: /View on Explorer/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /View transaction history/i }));
    expect(onOpenTransactionHistory).toHaveBeenCalledTimes(1);
  });
});
