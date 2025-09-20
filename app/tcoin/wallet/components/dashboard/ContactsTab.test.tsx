/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ContactsTab } from "./ContactsTab";

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn());
const openModalMock = vi.hoisted(() => vi.fn());
const closeModalMock = vi.hoisted(() => vi.fn());

const ownerWalletRows = [{ public_key: "0xabc" }];
const contactWalletMap = new Map<number, Array<{ public_key: string }>>([
  [11, [{ public_key: "0x1111" }]],
  [12, [{ public_key: "0x2222" }]],
]);
const actEntryRows = [
  {
    id: 100,
    wallet_account_from: "0xabc",
    wallet_account_to: "0x1111",
    amount: 5,
    created_at: "2024-03-01T12:00:00Z",
  },
  {
    id: 101,
    wallet_account_from: "0x1111",
    wallet_account_to: "0xabc",
    amount: 2,
    created_at: "2024-02-01T10:00:00Z",
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

const createClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    from: (table: string) => {
      if (table === "wallet_list") {
        return {
          select: () => ({
            eq: (_column: string, value: any) => {
              const id = Number(value);
              const data =
                id === 1
                  ? ownerWalletRows
                  : contactWalletMap.get(id) ?? [];
              return Promise.resolve({ data, error: null });
            },
          }),
        };
      }

      if (table === "act_transaction_entries") {
        return {
          select: () => ({
            eq: (_column: string, _value: any) => ({
              in: (column: string, values: any[]) => ({
                order: () => ({
                  limit: () => {
                    const needles = values.map((value) => String(value));
                    const data = actEntryRows.filter((row: any) =>
                      needles.includes(String(row[column as keyof typeof row] ?? ""))
                    );
                    return Promise.resolve({ data, error: null });
                  },
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      };
    },
  }))
);

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: createClientMock,
}));

describe("ContactsTab", () => {
  beforeEach(() => {
    fetchContactsForOwnerMock.mockReset();
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
    const getByCombinedText = (needle: string) =>
      modal.getByText((_content, element) => {
        if (!element || !(element instanceof HTMLElement)) {
          return false;
        }
        if (element.tagName !== "SPAN") {
          return false;
        }
        const text = element.textContent?.replace(/\s+/g, " ").trim();
        return text?.includes(needle) ?? false;
      });

    expect(getByCombinedText("Received 5.00 TCOIN")).toBeTruthy();
    expect(getByCombinedText("Sent 2.00 TCOIN")).toBeTruthy();
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
