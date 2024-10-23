interface QrScanModalProps {
  closeModal: () => void;
}

const QrScanModal = ({ closeModal }: QrScanModalProps) => {
  return (
    <div className="mt-2 p-0">
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-md text-muted-foreground">Camera feed would appear here</div>
    </div>
  );
};

export { QrScanModal };
