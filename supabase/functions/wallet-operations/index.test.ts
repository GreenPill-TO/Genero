/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServiceRoleClientMock = vi.hoisted(() => vi.fn(() => ({ serviceRole: true })));
const resolveAuthenticatedEdgeContextMock = vi.hoisted(() => vi.fn());
const walletOperationMocks = vi.hoisted(() => ({
  connectWalletContact: vi.fn(),
  getWalletContactDetail: vi.fn(),
  getWalletContactTransactionHistory: vi.fn(),
  getWalletTransactionHistory: vi.fn(),
  listWalletContactImports: vi.fn(),
  listWalletContacts: vi.fn(),
  listWalletRecents: vi.fn(),
  lookupWalletUserByIdentifier: vi.fn(),
  queueWalletContactInviteBatch: vi.fn(),
  recordWalletTransfer: vi.fn(),
  saveWalletContactImports: vi.fn(),
  sendWalletAdminNotification: vi.fn(),
  sendWalletSuccessNotification: vi.fn(),
  updateWalletContactState: vi.fn(),
}));

vi.mock("../_shared/auth.ts", () => ({
  createServiceRoleClient: createServiceRoleClientMock,
  resolveAuthenticatedEdgeContext: resolveAuthenticatedEdgeContextMock,
}));

vi.mock("../_shared/appContext.ts", () => ({
  resolveAppContextInput: vi.fn(() => ({
    appSlug: "wallet",
    citySlug: "tcoin",
    environment: "development",
  })),
}));

vi.mock("../_shared/walletOperations.ts", () => walletOperationMocks);

import { handleRequest } from "./index";

describe("wallet-operations handleRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedEdgeContextMock.mockResolvedValue({
      scopedClient: {},
      userRow: { id: 42 },
      appContext: {
        appSlug: "wallet",
        citySlug: "tcoin",
        environment: "development",
        appInstanceId: 7,
      },
    });
  });

  it("loads contacts through scoped identity/context and a route-specific service role", async () => {
    walletOperationMocks.listWalletContacts.mockResolvedValue({ contacts: [] });

    const res = await handleRequest(
      new Request("http://localhost/functions/v1/wallet-operations/contacts", {
        method: "GET",
        headers: { authorization: "Bearer user-token" },
      })
    );

    expect(res.status).toBe(200);
    expect(resolveAuthenticatedEdgeContextMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ purpose: "wallet operations scoped identity and app context" })
    );
    expect(createServiceRoleClientMock).toHaveBeenCalledWith({ purpose: "wallet operations /contacts operation" });
    expect(walletOperationMocks.listWalletContacts).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        appContext: expect.objectContaining({ appInstanceId: 7 }),
      })
    );
  });
});
