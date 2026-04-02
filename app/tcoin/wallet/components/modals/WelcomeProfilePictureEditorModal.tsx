"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Label } from "@shared/components/ui/Label";
import { Slider } from "@shared/components/ui/slider";
import {
  describeProfilePictureOrientation,
  getProfilePictureCropFrame,
  type PreparedProfilePicture,
  type ProfilePictureCropState,
} from "@shared/lib/profilePictureCrop";

const EDITOR_PREVIEW_SIZE = 220;

type WelcomeProfilePictureEditorModalProps = {
  closeModal: () => void;
  selection: PreparedProfilePicture;
  initialCrop: ProfilePictureCropState;
  onApply: (crop: ProfilePictureCropState) => void;
};

export default function WelcomeProfilePictureEditorModal({
  closeModal,
  selection,
  initialCrop,
  onApply,
}: WelcomeProfilePictureEditorModalProps) {
  const [crop, setCrop] = useState<ProfilePictureCropState>(initialCrop);

  const cropFrame = useMemo(
    () =>
      getProfilePictureCropFrame({
        imageWidth: selection.width,
        imageHeight: selection.height,
        cropSize: EDITOR_PREVIEW_SIZE,
        offsetX: crop.offsetX,
        offsetY: crop.offsetY,
        zoom: crop.zoom,
      }),
    [crop.offsetX, crop.offsetY, crop.zoom, selection.height, selection.width]
  );

  const orientation = describeProfilePictureOrientation(selection.width, selection.height);

  return (
    <div className="space-y-5" data-testid="welcome-picture-editor-modal">
      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-full border border-white/10 bg-background shadow-sm"
          style={{ width: EDITOR_PREVIEW_SIZE, height: EDITOR_PREVIEW_SIZE }}
        >
          <div
            aria-hidden="true"
            className="absolute max-w-none"
            style={{
              width: `${cropFrame.scaledWidth}px`,
              height: `${cropFrame.scaledHeight}px`,
              left: `${cropFrame.x}px`,
              top: `${cropFrame.y}px`,
              backgroundImage: `url(${selection.previewUrl})`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 100%",
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="welcome-profile-picture-zoom">Zoom</Label>
            <span className="text-xs text-muted-foreground">{crop.zoom.toFixed(1)}x</span>
          </div>
          <Slider
            id="welcome-profile-picture-zoom"
            aria-label="Zoom"
            min={1}
            max={2.5}
            step={0.05}
            value={[crop.zoom]}
            onValueChange={([zoom]) =>
              setCrop((current) => ({ ...current, zoom: zoom ?? current.zoom }))
            }
          />
        </div>

        {cropFrame.maxOffsetX > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="welcome-profile-picture-horizontal-position">Horizontal position</Label>
              <span className="text-xs text-muted-foreground">
                {orientation === "landscape" ? "Most useful for wide photos" : "Available after zooming"}
              </span>
            </div>
            <Slider
              id="welcome-profile-picture-horizontal-position"
              aria-label="Horizontal position"
              min={-100}
              max={100}
              step={1}
              value={[crop.offsetX]}
              onValueChange={([offsetX]) =>
                setCrop((current) => ({ ...current, offsetX: offsetX ?? current.offsetX }))
              }
            />
          </div>
        ) : null}

        {cropFrame.maxOffsetY > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="welcome-profile-picture-vertical-position">Vertical position</Label>
              <span className="text-xs text-muted-foreground">
                {orientation === "portrait" ? "Most useful for tall photos" : "Available after zooming"}
              </span>
            </div>
            <Slider
              id="welcome-profile-picture-vertical-position"
              aria-label="Vertical position"
              min={-100}
              max={100}
              step={1}
              value={[crop.offsetY]}
              onValueChange={([offsetY]) =>
                setCrop((current) => ({ ...current, offsetY: offsetY ?? current.offsetY }))
              }
            />
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={closeModal}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            onApply(crop);
            closeModal();
          }}
        >
          Use photo
        </Button>
      </div>
    </div>
  );
}
