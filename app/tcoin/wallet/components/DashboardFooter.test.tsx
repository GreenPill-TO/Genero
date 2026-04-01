/** @vitest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DashboardFooter } from "./DashboardFooter";

vi.mock("lucide-react", () => ({
  Home: () => <div />,
  QrCode: () => <div />,
  Send: () => <div />,
  Users: () => <div />,
  History: () => <div />,
  Settings: () => <div />,
}));

describe("DashboardFooter", () => {
  // jsdom doesn't implement scrollTo
  beforeAll(() => {
    (window as any).scrollTo = () => {};
  });

  afterEach(() => {
    cleanup();
  });

  it("calls onChange with correct key", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<DashboardFooter active="home" onChange={onChange} />);
    fireEvent.click(getByTestId("footer-receive"));
    expect(onChange).toHaveBeenCalledWith("receive");
    fireEvent.click(getByTestId("footer-send"));
    expect(onChange).toHaveBeenCalledWith("send");
  });

  it("uses the current send-tab highlight language for whichever footer tab is active", () => {
    const { getAllByTestId } = render(<DashboardFooter active="receive" onChange={() => {}} />);
    const receiveButton = getAllByTestId("footer-receive")[0];
    const sendButton = getAllByTestId("footer-send")[0];

    expect(receiveButton.className).toContain("-mt-4");
    expect(receiveButton.className).toContain("font-semibold");
    expect(sendButton.className).not.toContain("-mt-4");
    expect(sendButton.className).toContain("font-medium");
  });

  it("uses the same active-state language in the desktop sidebar", () => {
    const { getAllByTestId } = render(<DashboardFooter active="history" onChange={() => {}} />);
    const historyButton = getAllByTestId("sidebar-history")[0];
    const homeButton = getAllByTestId("sidebar-home")[0];

    expect(historyButton.className).toContain("font-semibold");
    expect(homeButton.className).toContain("font-medium");
  });

  it("uses the widened desktop sidebar shell and larger compact item sizing", () => {
    const { getAllByTestId } = render(<DashboardFooter active="home" onChange={() => {}} />);
    expect(getAllByTestId("sidebar-shell")[0].className).toContain("w-[112px]");
    expect(getAllByTestId("sidebar-shell")[0].className).toContain("font-sans");
    expect(getAllByTestId("sidebar-home")[0].className).toContain("text-xs");
    expect(getAllByTestId("sidebar-home")[0].className).toContain("font-sans");
  });
});
