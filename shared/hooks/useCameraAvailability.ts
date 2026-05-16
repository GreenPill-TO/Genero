import { useEffect, useState } from "react";

type CameraAvailabilityState = {
  hasCamera: boolean;
  hasMultipleCameras: boolean;
  isCheckingCamera: boolean;
};

const DEFAULT_STATE: CameraAvailabilityState = {
  hasCamera: false,
  hasMultipleCameras: false,
  isCheckingCamera: true,
};

export function useCameraAvailability(): CameraAvailabilityState {
  const [state, setState] = useState<CameraAvailabilityState>(DEFAULT_STATE);

  useEffect(() => {
    if (typeof window === "undefined") {
      setState({
        hasCamera: false,
        hasMultipleCameras: false,
        isCheckingCamera: false,
      });
      return;
    }

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== "function") {
      setState({
        hasCamera: false,
        hasMultipleCameras: false,
        isCheckingCamera: false,
      });
      return;
    }

    let isActive = true;

    const updateState = async () => {
      try {
        const devices = await mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((device) => device.kind === "videoinput");

        if (!isActive) return;

        setState({
          hasCamera: videoInputs.length > 0,
          hasMultipleCameras: videoInputs.length > 1,
          isCheckingCamera: false,
        });
      } catch {
        if (!isActive) return;

        setState({
          hasCamera: false,
          hasMultipleCameras: false,
          isCheckingCamera: false,
        });
      }
    };

    void updateState();

    const handleDeviceChange = () => {
      setState((current) => ({ ...current, isCheckingCamera: true }));
      void updateState();
    };

    mediaDevices.addEventListener?.("devicechange", handleDeviceChange);

    return () => {
      isActive = false;
      mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, []);

  return state;
}
