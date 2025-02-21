import { Button } from "@shared/components/ui/Button";
import { toast } from "react-toastify";

interface ShareQrModalProps {
  closeModal: () => void;
  qrCodeData: string;
}

const ShareQrModal = ({ closeModal, qrCodeData }: ShareQrModalProps) => {
  // Use the provided link from qrCodeData, or fallback to a default URL.
  const link = qrCodeData || "https://example.com/qr-code-link";

  // Opens the user's default email client with a prefilled subject and body.
  const handleEmailShare = () => {
    const subject = encodeURIComponent("Check out this QR Code!");
    const body = encodeURIComponent(`Please check out this QR code link: ${link}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    closeModal();
  };

  // Opens the SMS app with a prefilled message body.
  const handleSmsShare = () => {
    const body = encodeURIComponent(`Please check out this QR code link: ${link}`);
    window.open(`sms:?body=${body}`, "_blank");
    closeModal();
  };

  // Copies the link to the user's clipboard and displays a success toast.
  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        toast.success("The QR code link has been copied to your clipboard.");
        closeModal();
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  // Uses the Web Share API to share the link natively.
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "QR Code Link",
          text: "Check out this QR code link!",
          url: link,
        });
        toast.success("Thanks for sharing!");
      } catch (error) {
        console.error("Error sharing:", error);
        toast.error("Failed to share.");
      }
    } else {
      toast.error("Native share is not supported on this device.");
    }
    closeModal();
  };

  return (
    <div className="mt-2 p-0">
      <div className="space-y-4">
        <Button className="w-full" onClick={handleEmailShare}>
          Share via Email
        </Button>
        <Button className="w-full" onClick={handleNativeShare}>
          Share
        </Button>
        <Button className="w-full" onClick={handleCopyLink}>
          Copy Link
        </Button>
      </div>
    </div>
  );
};

export { ShareQrModal };
