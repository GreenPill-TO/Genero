/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharitySelectModal } from "./CharitySelectModal";

vi.mock("@shared/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    bootstrap: {
      preferences: {
        charity: "The FoodBank",
      },
      options: {
        charities: [{ id: "1", name: "The FoodBank", value: "The FoodBank" }],
      },
    },
  }),
}));

vi.mock("@shared/hooks/useUserSettingsMutations", () => ({
  useUpdateUserPreferencesMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe("CharitySelectModal", () => {
  it("calls closeModal on Escape key press", () => {
    const closeModal = vi.fn();
    const setSelectedCharity = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <CharitySelectModal
          closeModal={closeModal}
          selectedCharity="The FoodBank"
          setSelectedCharity={setSelectedCharity}
        />
      </QueryClientProvider>
    );

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);

    expect(closeModal).toHaveBeenCalled();
  });
});
