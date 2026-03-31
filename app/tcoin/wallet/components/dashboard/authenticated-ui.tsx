import React from "react";
import { cn } from "@shared/utils/classnames";

export const walletPageClass =
  "mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 pb-24 pt-4 sm:gap-6 sm:px-6 sm:pb-28 sm:pt-5 lg:px-8 lg:pb-10 lg:pt-8";

export const walletPanelClass =
  "rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,247,249,0.88))] p-4 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur sm:rounded-[28px] sm:p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,25,34,0.94),rgba(10,15,21,0.92))] dark:text-slate-50 dark:shadow-[0_32px_80px_rgba(2,6,23,0.5)]";

export const walletPanelMutedClass =
  "rounded-[20px] border border-slate-200/70 bg-white/70 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[24px] sm:p-4 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none";

export const walletBadgeClass =
  "inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:px-3 sm:text-[11px] sm:tracking-[0.24em] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300";

export const walletActionButtonClass =
  "rounded-full border border-slate-200/70 bg-white/90 px-3.5 py-1.5 text-[13px] font-medium text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white sm:px-4 sm:py-2 sm:text-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]";

export function WalletPageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl space-y-3">
        {eyebrow ? <span className={walletBadgeClass}>{eyebrow}</span> : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-xl text-[13px] leading-5 text-slate-600 dark:text-slate-300 sm:text-base sm:leading-6">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function WalletSection({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn(walletPanelClass, className)}>{children}</section>;
}
