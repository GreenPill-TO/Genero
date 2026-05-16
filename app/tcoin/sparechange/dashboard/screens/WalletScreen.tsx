import dynamic from "next/dynamic";

const MobileWalletDashboardComponent = dynamic(
  () =>
    import("@tcoin/sparechange/dashboard/screens/WalletComponent").then(
      (mod) => mod.MobileWalletDashboardComponent
    ),
  {
    loading: () => <div className="py-8 text-sm text-muted-foreground">Loading wallet dashboard…</div>,
  }
);

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
