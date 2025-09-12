/** @vitest-environment jsdom */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("react-toastify", () => ({
  toast: { success: toastSuccess },
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    userData: { cubidData: { id: 42, user_identifier: "abc" } },
  }),
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: vi.fn(), closeModal: vi.fn() }),
}));

vi.mock("@shared/hooks/useGetLatestExchangeRate", () => ({
  useControlVariables: () => ({ exchangeRate: 1 }),
}));

vi.mock("@shared/hooks/useSendMoney", () => ({
  useSendMoney: () => ({ sendMoney: vi.fn() }),
}));

vi.mock("@shared/hooks/useTokenBalance", () => ({
  useTokenBalance: () => ({ balance: "0" }),
}));

const matchMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [{ id: 7 }], error: null })
);
const insertMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const fromMock = vi.hoisted(() => vi.fn((table: string) => {
  if (table === "users") {
    return { select: () => ({ match: matchMock }) } as any;
  }
  return { insert: insertMock } as any;
}));

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}));

vi.mock("@tcoin/wallet/components/modals", () => ({
  QrScanModal: () => <div>qr-modal</div>,
}));

vi.mock("./ContributionsCard", () => ({
  ContributionsCard: () => <div />,
}));
vi.mock("./ReceiveCard", () => ({ ReceiveCard: () => <div /> }));
vi.mock("./SendCard", () => ({ SendCard: () => <div /> }));
vi.mock("./AccountCard", () => ({ AccountCard: () => <div /> }));
vi.mock("./OtherCard", () => ({ OtherCard: () => <div /> }));

import { WalletHome } from "./WalletHome";

describe("WalletHome deep-link scanning", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    matchMock.mockClear();
    insertMock.mockClear();
    window.history.replaceState({}, "", "/dashboard");
  });

  it("skips handleScan when URL lacks pay param", () => {
    render(<WalletHome />);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(matchMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("processes scan and shows toast when URL has pay param", async () => {
    const payload = btoa(
      unescape(
        encodeURIComponent(
          JSON.stringify({ nano_id: "target", qrTcoinAmount: "2" })
        )
      )
    );
    window.history.replaceState({}, "", `/dashboard?pay=${payload}`);

    render(<WalletHome />);

    await waitFor(() => {
      expect(matchMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
      expect(toastSuccess).toHaveBeenCalledWith("Scanned User Successfully");
    });
  });
});

