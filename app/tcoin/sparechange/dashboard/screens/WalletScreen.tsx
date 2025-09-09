import { MobileWalletDashboardComponent } from "@tcoin/sparechange/dashboard/screens/WalletComponent";

export function WalletScreen({
  qrBgColor,
  qrFgColor,
}: {
  qrBgColor?: string;
  qrFgColor?: string;
}) {
  return (
    <div>
      <MobileWalletDashboardComponent qrBgColor={qrBgColor} qrFgColor={qrFgColor} />
    </div>
  );
}
