/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { revokePreparedProfilePicturePreview } from "./profilePictureCrop";

describe("revokePreparedProfilePicturePreview", () => {
  beforeEach(() => {
    URL.revokeObjectURL = vi.fn();
  });

  it("revokes blob preview URLs", () => {
    revokePreparedProfilePicturePreview({
      file: new File(["avatar"], "avatar.png", { type: "image/png" }),
      previewUrl: "blob:avatar-preview",
      width: 400,
      height: 400,
    });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:avatar-preview");
  });

  it("ignores non-blob preview URLs", () => {
    revokePreparedProfilePicturePreview({
      file: new File(["avatar"], "avatar.png", { type: "image/png" }),
      previewUrl: "https://cdn.example.com/avatar.png",
      width: 400,
      height: 400,
    });

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
