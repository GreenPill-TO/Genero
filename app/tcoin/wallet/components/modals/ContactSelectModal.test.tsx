/** @vitest-environment jsdom */
import { beforeEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
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
  },
]);

const insertMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: insertMock,
    }),
  }),
}));

const fetchContactsForOwnerMock = vi.hoisted(() => vi.fn());

vi.mock("@shared/api/services/supabaseService", () => ({
  fetchContactsForOwner: fetchContactsForOwnerMock,
}));

vi.mock("@shared/utils/insertNotification", () => ({
  insertSuccessNotification: vi.fn(),
}));

describe("ContactSelectModal", () => {
  beforeEach(() => {
    fetchContactsForOwnerMock.mockReset();
    fetchContactsForOwnerMock.mockResolvedValue(mockContacts);
    insertMock.mockReset();
  });

  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const queryClient = new QueryClient();
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ContactSelectModal
            closeModal={closeModal}
            amount="10"
            method="Send"
            setToSendData={vi.fn()}
          />
        </QueryClientProvider>
      );
    });

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      document.dispatchEvent(event);
    });

    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("passes full contact object to setToSendData", async () => {
    const closeModal = vi.fn();
    const setToSendData = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const queryClient = new QueryClient();
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ContactSelectModal
            closeModal={closeModal}
            amount="5"
            method="Send"
            setToSendData={setToSendData}
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const sendButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Send 5"
    ) as HTMLButtonElement;
    act(() => {
      sendButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setToSendData).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, full_name: "Alice" })
    );

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("creates an invoice request when the method is Request", async () => {
    const closeModal = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    insertMock.mockResolvedValue({ data: null });

    const queryClient = new QueryClient();
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ContactSelectModal
            closeModal={closeModal}
            amount="$5"
            method="Request"
            setToSendData={vi.fn()}
          />
        </QueryClientProvider>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const requestButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Request $5"
    ) as HTMLButtonElement;

    act(() => {
      requestButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(insertMock).toHaveBeenCalledWith({
      request_from: 2,
      request_by: 1,
      amount_requested: 5,
    });
    expect(closeModal).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });
});
