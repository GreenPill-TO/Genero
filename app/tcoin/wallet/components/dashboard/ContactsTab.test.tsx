/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ContactsTab } from "./ContactsTab";

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn());
const openModalMock = vi.hoisted(() => vi.fn());
const closeModalMock = vi.hoisted(() => vi.fn());
const getWalletContactTransactionHistoryMock = vi.hoisted(() => vi.fn());
const getWalletContactImportsMock = vi.hoisted(() => vi.fn());
const saveWalletContactImportsMock = vi.hoisted(() => vi.fn());
const queueWalletContactInviteBatchMock = vi.hoisted(() => vi.fn());

const actEntryRows = [
  {
    id: 100,
    amount: 5,
    createdAt: "2024-03-01T12:00:00Z",
    direction: "received",
  },
  {
    id: 101,
    amount: 2,
    createdAt: "2024-02-01T10:00:00Z",
    direction: "sent",
  },
];

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({
    userData: {
      cubidData: {
        id: 1,
        nickname: "Taylor",
        full_name: "Taylor Example",
        email: "taylor@example.com",
      },
      user: {
        email: "taylor@example.com",
      },
    },
  }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  fetchContactsForOwner: fetchContactsForOwnerMock,
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: openModalMock, closeModal: closeModalMock }),
}));

vi.mock("@shared/lib/edge/walletOperationsClient", () => ({
  getWalletContactTransactionHistory: getWalletContactTransactionHistoryMock,
  getWalletContactImports: getWalletContactImportsMock,
  saveWalletContactImports: saveWalletContactImportsMock,
  queueWalletContactInviteBatch: queueWalletContactInviteBatchMock,
}));

describe("ContactsTab", () => {
  beforeEach(() => {
    fetchContactsForOwnerMock.mockReset();
    getWalletContactTransactionHistoryMock.mockReset();
    getWalletContactImportsMock.mockReset();
    saveWalletContactImportsMock.mockReset();
    queueWalletContactInviteBatchMock.mockReset();
    fetchContactsForOwnerMock.mockResolvedValue([
      {
        id: 11,
        full_name: "Alice",
        username: "alice",
        profile_image_url: null,
        wallet_address: "0x1111",
        state: "accepted",
        last_interaction: "2024-01-02T00:00:00.000Z",
      },
      {
        id: 12,
        full_name: "Bob",
        username: "bob",
        profile_image_url: null,
        wallet_address: "0x2222",
        state: "accepted",
        last_interaction: "2024-01-03T00:00:00.000Z",
      },
    ]);
    getWalletContactTransactionHistoryMock.mockImplementation(async (contactId: number) => ({
      transactions: contactId === 11 ? actEntryRows : [],
    }));
    getWalletContactImportsMock.mockResolvedValue({
      preference: null,
      importedContacts: [],
    });
    saveWalletContactImportsMock.mockResolvedValue({
      preference: {
        granted: true,
        source: "browser-contact-picker",
        createdAt: "2026-04-01T20:00:00.000Z",
        updatedAt: "2026-04-01T20:00:00.000Z",
      },
      importedContacts: [],
    });
    queueWalletContactInviteBatchMock.mockResolvedValue({
      batch: {
        id: 41,
        source: "manual",
        status: "queued",
        subject: "Join me on TCOIN",
        message: "Hi",
        recipientCount: 1,
        createdAt: "2026-04-01T20:15:00.000Z",
      },
    });
  });

  afterEach(() => {
    cleanup();
    openModalMock.mockReset();
    closeModalMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sorts alphabetically by default and toggles to recents", async () => {
    render(<ContactsTab onSend={vi.fn()} onRequest={vi.fn()} />);

    const items = await screen.findAllByRole("listitem");
    expect(items[0].textContent).toContain("Alice");

    fireEvent.click(screen.getByRole("button", { name: /Recents/i }));

    const resorted = await screen.findAllByRole("listitem");
    expect(resorted[0].textContent).toContain("Bob");
  });

  it("invokes callbacks for Send To and Request From", async () => {
    const onSend = vi.fn();
    const onRequest = vi.fn();
    render(<ContactsTab onSend={onSend} onRequest={onRequest} />);

    await screen.findByText("Alice");

    const sendToAliceButton = await screen.findByRole("button", {
      name: /Send to Alice/i,
    });

    fireEvent.click(sendToAliceButton);
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11, full_name: "Alice" })
    );

    const requestFromAliceButton = await screen.findByRole("button", {
      name: /Request from Alice/i,
    });

    fireEvent.click(requestFromAliceButton);
    await waitFor(() => expect(onRequest).toHaveBeenCalled());
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11, full_name: "Alice" })
    );
  });

  it("shows transaction summaries for each contact", async () => {
    render(<ContactsTab onSend={vi.fn()} onRequest={vi.fn()} />);

    const summary = await screen.findByText(/Last transaction:/i);
    expect(summary.textContent).toMatch(/2024/);

    const emptySummary = await screen.findByText(/No transactions yet/i);
    expect(emptySummary).toBeTruthy();
  });

  it("opens the transactions modal with transfer history", async () => {
    render(<ContactsTab onSend={vi.fn()} onRequest={vi.fn()} />);

    const viewButtons = await screen.findAllByRole("button", { name: /View Transactions/i });
    fireEvent.click(viewButtons[0]);

    expect(openModalMock).toHaveBeenCalled();
    const modalArgs = openModalMock.mock.calls.at(-1)![0];
    const modal = render(modalArgs.content as React.ReactElement);

    expect(modal.getByText("Received 5.00 TCOIN")).toBeTruthy();
    expect(modal.getByText("Sent 2.00 TCOIN")).toBeTruthy();
    modal.unmount();
  });

  it("notifies when contacts are resolved and seeds initial contacts", async () => {
    const onContactsResolved = vi.fn();
    const seed = [
      {
        id: 5,
        full_name: "Zara",
        username: "zara",
        profile_image_url: null,
        wallet_address: null,
        state: "accepted",
        last_interaction: "2024-01-04T00:00:00.000Z",
      },
    ];
    fetchContactsForOwnerMock.mockImplementation(() => new Promise(() => {}));

    render(
      <ContactsTab
        onSend={vi.fn()}
        initialContacts={seed as any}
        onContactsResolved={onContactsResolved}
      />
    );

    expect(await screen.findByText("Zara")).toBeTruthy();

    await waitFor(() =>
      expect(onContactsResolved).toHaveBeenCalledWith([
        expect.objectContaining({ full_name: "Zara" }),
      ])
    );
  });

  it("shows a friendly invite workflow when no contacts exist", async () => {
    fetchContactsForOwnerMock.mockResolvedValue([]);

    render(<ContactsTab onSend={vi.fn()} onRequest={vi.fn()} />);

    expect(await screen.findByText("It looks empty here.")).toBeTruthy();
    expect(
      screen.getByText("TCOIN is about collaboration. Let's invite a few of your friends.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add another/i })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Queue invite batch/i }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("queues a manual invite batch from the empty state", async () => {
    fetchContactsForOwnerMock.mockResolvedValue([]);

    render(<ContactsTab onSend={vi.fn()} />);

    await screen.findByText("It looks empty here.");

    fireEvent.change(screen.getByLabelText("Manual invite email 1"), {
      target: { value: "friend@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Queue invite batch/i }));

    await waitFor(() =>
      expect(queueWalletContactInviteBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Join me on TCOIN",
          recipients: [
            expect.objectContaining({
              email: "friend@example.com",
              source: "manual",
            }),
          ],
        }),
        { citySlug: "tcoin" }
      )
    );

    expect(await screen.findByText(/invite queued/i)).toBeTruthy();
  });

  it("imports contacts, saves them, and lets the user queue imported invitees", async () => {
    fetchContactsForOwnerMock.mockResolvedValue([]);
    const pickerSelect = vi.fn().mockResolvedValue([
      {
        name: ["Alex Friend"],
        email: ["alex@example.com"],
      },
    ]);
    vi.stubGlobal("navigator", {
      contacts: {
        select: pickerSelect,
      },
    });
    saveWalletContactImportsMock.mockResolvedValue({
      preference: {
        granted: true,
        source: "browser-contact-picker",
        createdAt: "2026-04-01T20:00:00.000Z",
        updatedAt: "2026-04-01T20:00:00.000Z",
      },
      importedContacts: [
        {
          id: 7,
          displayName: "Alex Friend",
          email: "alex@example.com",
          source: "browser-contact-picker",
          createdAt: "2026-04-01T20:00:00.000Z",
          updatedAt: "2026-04-01T20:00:00.000Z",
        },
      ],
    });
    queueWalletContactInviteBatchMock.mockResolvedValue({
      batch: {
        id: 42,
        source: "imported",
        status: "queued",
        subject: "Join me on TCOIN",
        message: "Hi",
        recipientCount: 1,
        createdAt: "2026-04-01T20:15:00.000Z",
      },
    });

    render(<ContactsTab onSend={vi.fn()} />);

    await screen.findByText("It looks empty here.");

    fireEvent.click(screen.getByRole("button", { name: /Import contacts/i }));

    await waitFor(() =>
      expect(saveWalletContactImportsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          granted: true,
          contacts: [
            {
              displayName: "Alex Friend",
              email: "alex@example.com",
            },
          ],
        }),
        { citySlug: "tcoin" }
      )
    );

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Queue invite batch/i }));

    await waitFor(() =>
      expect(queueWalletContactInviteBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: [
            expect.objectContaining({
              email: "alex@example.com",
              source: "imported",
            }),
          ],
        }),
        { citySlug: "tcoin" }
      )
    );
  });
});
