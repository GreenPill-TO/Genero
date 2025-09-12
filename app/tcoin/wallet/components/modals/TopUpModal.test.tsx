/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { TopUpModal } from "./TopUpModal";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("TopUpModal", () => {
  it("renders", () => {
    const closeModal = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <TopUpModal closeModal={closeModal} />
      </QueryClientProvider>
    );
  });
});
