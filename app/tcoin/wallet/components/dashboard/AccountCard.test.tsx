/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";

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
  afterEach(cleanup);

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

  it("does not present Preview test tokens as CAD or spendable value", () => {
    render(
      <AccountCard
        balance={10}
        senderWallet="0xabc123"
        isTestToken
        onOpenTransactionHistory={vi.fn()}
      />
    );

    expect(screen.getByText(/Test token balance/i)).toBeTruthy();
    expect(screen.getByText(/no cash value/i)).toBeTruthy();
    expect(screen.queryByText(/ready to spend/i)).toBeNull();
    expect(screen.queryByText(/CAD/i)).toBeNull();
    expect(screen.queryByText(/Spendable now/i)).toBeNull();
  });
});
