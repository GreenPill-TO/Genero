import { MobileWalletDashboardComponent } from "@tcoin/sparechange/dashboard/screens/WalletComponent";

export function WalletScreen({
  qrBgColor,
  qrFgColor,
  qrWrapperClassName,
  tokenLabel,
}: {
  qrBgColor?: string;
  qrFgColor?: string;
  qrWrapperClassName?: string;
  tokenLabel?: string;
}) {
  return (
    <div>
      <MobileWalletDashboardComponent
        qrBgColor={qrBgColor}
        qrFgColor={qrFgColor}
        qrWrapperClassName={qrWrapperClassName}
        tokenLabel={tokenLabel}
      />
    </div>
  );
}
