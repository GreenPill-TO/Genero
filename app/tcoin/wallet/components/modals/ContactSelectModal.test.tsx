/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContactSelectModal } from "./ContactSelectModal";

const mockUser = { cubidData: { id: 1, full_name: "User" } };
vi.mock("@shared/api/hooks/useAuth", () => ({
  useAuth: () => ({ userData: mockUser }),
}));

const mockContacts = [
  { id: 1, state: "accepted", connected_user_id: { id: 2, full_name: "Alice" } },
];

vi.mock("@shared/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: mockContacts, error: null }),
      }),
    }),
  }),
}));

vi.mock("@shared/utils/insertNotification", () => ({
  insertSuccessNotification: vi.fn(),
}));

describe("ContactSelectModal", () => {
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
});
