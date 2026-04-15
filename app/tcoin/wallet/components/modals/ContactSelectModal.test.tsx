/** @vitest-environment jsdom */
import { beforeEach, describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContactSelectModal } from "./ContactSelectModal";

const mockUser = { cubidData: { id: 1, full_name: "User" } };
vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({ userData: mockUser }),
}));

const mockContacts = vi.hoisted(() => [
  {
    id: 2,
    full_name: "Alice",
    username: "alice",
    profile_image_url: null,
    wallet_address: null,
    state: "accepted",
    last_interaction: null,
  },
]);

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/services/supabaseService", () => ({
  fetchContactsForOwner: fetchContactsForOwnerMock,
}));

describe("ContactSelectModal", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    fetchContactsForOwnerMock.mockReset();
    fetchContactsForOwnerMock.mockResolvedValue(mockContacts);
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockClear();
  });

  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ContactSelectModal
          closeModal={closeModal}
          amount="10"
          method="Send"
          setToSendData={vi.fn()}
        />
      </QueryClientProvider>
    );

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      document.dispatchEvent(event);
    });

    expect(closeModal).toHaveBeenCalled();
  });

  it("passes full contact object to setToSendData", async () => {
    const closeModal = vi.fn();
    const setToSendData = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ContactSelectModal
          closeModal={closeModal}
          amount="5"
          method="Send"
          setToSendData={setToSendData}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send 5" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Send 5" }));

    expect(setToSendData).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, full_name: "Alice" })
    );
  });

  it("selects the provided default contact id", async () => {
    const closeModal = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ContactSelectModal
          closeModal={closeModal}
          amount="5"
          method="Send"
          defaultContactId={2}
          setToSendData={vi.fn()}
        />
      </QueryClientProvider>
    );

    const selectedRadio = await screen.findByRole("radio", { name: "Alice (@alice)" }) as HTMLInputElement;
    expect(selectedRadio?.checked).toBe(true);
  });

  it("defers request creation and simply selects the contact", async () => {
    const closeModal = vi.fn();
    const onSelectContact = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ContactSelectModal
          closeModal={closeModal}
          amount="$5"
          method="Request"
          onSelectContact={onSelectContact}
        />
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Request $5" }));

    expect(onSelectContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, full_name: "Alice" })
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it("invokes onSelectContact when a selection is made", async () => {
    const closeModal = vi.fn();
    const onSelectContact = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ContactSelectModal
          closeModal={closeModal}
          amount="5"
          method="Send"
          setToSendData={vi.fn()}
          onSelectContact={onSelectContact}
        />
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Send 5" }));

    expect(onSelectContact).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, full_name: "Alice" })
    );
  });

  it("falls back to prefetched contacts when fetching fails", async () => {
    fetchContactsForOwnerMock.mockRejectedValueOnce(new Error("nope"));
    const closeModal = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ContactSelectModal
          closeModal={closeModal}
          amount="5"
          method="Send"
          prefetchedContacts={mockContacts}
          setToSendData={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("radio", { name: "Alice (@alice)" })).toBeTruthy();
  });
});
