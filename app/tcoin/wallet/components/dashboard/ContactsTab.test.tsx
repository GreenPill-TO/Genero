/** @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ContactsTab } from "./ContactsTab";

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({ userData: { cubidData: { id: 1 } } }),
}));

vi.mock("@shared/api/services/supabaseService", () => ({
  fetchContactsForOwner: fetchContactsForOwnerMock,
}));

describe("ContactsTab", () => {
  beforeEach(() => {
    fetchContactsForOwnerMock.mockReset();
    fetchContactsForOwnerMock.mockResolvedValue([
      {
        id: 1,
        full_name: "Alice",
        username: "alice",
        profile_image_url: null,
        wallet_address: "0x1111",
        state: "accepted",
        last_interaction: "2024-01-02T00:00:00.000Z",
      },
      {
        id: 2,
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
      expect.objectContaining({ id: 1, full_name: "Alice" })
    );

    const requestFromAliceButton = await screen.findByRole("button", {
      name: /Request from Alice/i,
    });

    fireEvent.click(requestFromAliceButton);
    await waitFor(() => expect(onRequest).toHaveBeenCalled());
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, full_name: "Alice" })
    );
  });
});
