import React from "react";
import { cn } from "@shared/utils/classnames";

export const walletPageClass =
  "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8";

export const walletPanelClass =
  "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,247,249,0.88))] p-5 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(18,25,34,0.94),rgba(10,15,21,0.92))] dark:text-slate-50 dark:shadow-[0_32px_80px_rgba(2,6,23,0.5)]";

export const walletPanelMutedClass =
  "rounded-[24px] border border-slate-200/70 bg-white/70 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none";

export const walletBadgeClass =
  "inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300";

export const walletActionButtonClass =
  "rounded-full border border-slate-200/70 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]";

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
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
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
