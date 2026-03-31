/** @vitest-environment jsdom */
import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

  it("calls onChange with correct key", () => {
    const onChange = vi.fn();
    const { getByTestId } = render(<DashboardFooter active="home" onChange={onChange} />);
    fireEvent.click(getByTestId("footer-receive"));
    expect(onChange).toHaveBeenCalledWith("receive");
    fireEvent.click(getByTestId("footer-send"));
    expect(onChange).toHaveBeenCalledWith("send");
  });

  it("highlights send button", () => {
    const { getAllByTestId } = render(<DashboardFooter active="home" onChange={() => {}} />);
    const sendButton = getAllByTestId("footer-send")[0];
    expect(sendButton.className).toContain("-mt-4");
  });

  it("uses the widened desktop sidebar shell and larger compact item sizing", () => {
    const { getAllByTestId } = render(<DashboardFooter active="home" onChange={() => {}} />);
    expect(getAllByTestId("sidebar-shell")[0].className).toContain("w-[112px]");
    expect(getAllByTestId("sidebar-home")[0].className).toContain("text-xs");
  });
});
