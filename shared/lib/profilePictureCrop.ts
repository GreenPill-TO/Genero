"use client";

export type PreparedProfilePicture = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
};

export type ProfilePictureCropState = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

type CropFrameOptions = {
  imageWidth: number;
  imageHeight: number;
  cropSize: number;
  offsetX: number;
  offsetY: number;
  zoom: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the selected image."));
    image.src = url;
  });
}

export async function prepareProfilePicture(file: File): Promise<PreparedProfilePicture> {
  const previewUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(previewUrl);
    return {
      file,
      previewUrl,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export function getProfilePictureCropFrame(options: CropFrameOptions) {
  const imageWidth = Math.max(1, options.imageWidth);
  const imageHeight = Math.max(1, options.imageHeight);
  const cropSize = Math.max(1, options.cropSize);
  const zoom = clamp(options.zoom, 1, 3);
  const baseScale = Math.max(cropSize / imageWidth, cropSize / imageHeight);
  const scaledWidth = imageWidth * baseScale * zoom;
  const scaledHeight = imageHeight * baseScale * zoom;
  const maxOffsetX = Math.max(0, (scaledWidth - cropSize) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - cropSize) / 2);
  const appliedOffsetX = clamp(options.offsetX, -100, 100) * (maxOffsetX / 100);
  const appliedOffsetY = clamp(options.offsetY, -100, 100) * (maxOffsetY / 100);

  return {
    scaledWidth,
    scaledHeight,
    x: (cropSize - scaledWidth) / 2 + appliedOffsetX,
    y: (cropSize - scaledHeight) / 2 + appliedOffsetY,
    maxOffsetX,
    maxOffsetY,
  };
}

export function describeProfilePictureOrientation(width: number, height: number) {
  if (width > height) {
    return "landscape" as const;
  }
  if (height > width) {
    return "portrait" as const;
  }
  return "square" as const;
}

export async function createCroppedProfilePictureFile(options: {
  source: PreparedProfilePicture;
  crop: ProfilePictureCropState;
  outputSize?: number;
}) {
  const outputSize = options.outputSize ?? 512;
  const image = await loadImage(options.source.previewUrl);
  const frame = getProfilePictureCropFrame({
    imageWidth: options.source.width,
    imageHeight: options.source.height,
    cropSize: outputSize,
    offsetX: options.crop.offsetX,
    offsetY: options.crop.offsetY,
    zoom: options.crop.zoom,
  });

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare your profile picture.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, outputSize, outputSize);
  context.drawImage(image, frame.x, frame.y, frame.scaledWidth, frame.scaledHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/png", 0.92);
  });

  if (!blob) {
    throw new Error("Unable to prepare your profile picture.");
  }

  const safeBaseName =
    options.source.file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-") || "avatar";

  return new File([blob], `${safeBaseName}-cropped.png`, {
    type: "image/png",
    lastModified: Date.now(),
  });
}
