/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ContactsTab } from "./ContactsTab";

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn());
const openModalMock = vi.hoisted(() => vi.fn());
const closeModalMock = vi.hoisted(() => vi.fn());
const getWalletContactTransactionHistoryMock = vi.hoisted(() => vi.fn());
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

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({ userData: { cubidData: { id: 1 } } }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  fetchContactsForOwner: fetchContactsForOwnerMock,
}));

vi.mock("@shared/contexts/ModalContext", () => ({
  useModal: () => ({ openModal: openModalMock, closeModal: closeModalMock }),
}));
vi.mock("@shared/lib/edge/walletOperationsClient", () => ({
  getWalletContactTransactionHistory: getWalletContactTransactionHistoryMock,
}));

describe("ContactsTab", () => {
  beforeEach(() => {
    fetchContactsForOwnerMock.mockReset();
    getWalletContactTransactionHistoryMock.mockReset();
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
  });

  afterEach(() => {
    cleanup();
    openModalMock.mockReset();
    closeModalMock.mockReset();
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

    const listItems = screen.getAllByRole("listitem");
    expect(listItems.length).toBe(2);

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

    render(
      <ContactsTab
        onSend={vi.fn()}
        initialContacts={seed as any}
        onContactsResolved={onContactsResolved}
      />
    );

    expect(await screen.findByText("Zara")).toBeTruthy();

    await waitFor(() => expect(onContactsResolved).toHaveBeenCalled());
  });
});
