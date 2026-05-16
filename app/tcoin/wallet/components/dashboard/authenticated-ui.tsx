import React from "react";
import { cn } from "@shared/utils/classnames";

export const walletPageClass =
  "mx-auto flex w-full max-w-[90rem] flex-col gap-4 px-0 pb-24 pt-3 sm:gap-6 sm:px-6 sm:pb-28 sm:pt-5 lg:gap-5 lg:px-5 lg:pb-8 lg:pt-5 xl:px-4 xl:pb-7 min-[1850px]:max-w-[112rem] min-[1850px]:px-6 min-[1850px]:pb-9";

export const walletRailPageClass =
  "lg:max-w-[calc(90rem+8.25rem)] lg:pl-[9.5rem] xl:max-w-[calc(90rem+9.5rem)] xl:pl-[10.5rem] min-[1850px]:max-w-[calc(112rem+9.5rem)] min-[1850px]:pl-[11rem]";

export const walletPanelClass =
  "rounded-none border-0 border-b border-slate-200/70 bg-transparent px-5 py-5 text-slate-900 shadow-none sm:rounded-[28px] sm:border sm:border-white/10 sm:bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,247,249,0.88))] sm:p-5 sm:shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:backdrop-blur dark:border-white/10 dark:bg-transparent dark:text-slate-50 dark:sm:bg-[linear-gradient(180deg,rgba(18,25,34,0.94),rgba(10,15,21,0.92))] dark:sm:shadow-[0_32px_80px_rgba(2,6,23,0.5)]";

export const walletPanelMutedClass =
  "rounded-none border-0 border-t border-slate-200/60 bg-transparent px-0 pt-4 shadow-none sm:rounded-[24px] sm:border sm:bg-white/68 sm:p-4 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.48)] sm:backdrop-blur dark:border-white/10 dark:bg-transparent dark:sm:border-white/8 dark:sm:bg-white/[0.035] dark:sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

export const walletBadgeClass =
  "inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:px-3 sm:text-[11px] sm:tracking-[0.24em] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300";

export const walletActionButtonClass =
  "rounded-full border border-slate-300/80 bg-white/96 px-3.5 py-1.5 text-[13px] font-medium text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-teal-500/10 transition duration-200 hover:-translate-y-0.5 hover:border-teal-600/30 hover:bg-white sm:px-4 sm:py-2 sm:text-sm dark:border-teal-400/16 dark:bg-white/[0.07] dark:text-slate-100 dark:ring-teal-400/12 dark:hover:border-teal-300/30 dark:hover:bg-white/[0.1]";

export const walletSectionLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-300";

export const walletMetricTileClass =
  "rounded-none border-0 border-t border-slate-200/60 bg-transparent px-0 pt-4 shadow-none sm:rounded-[20px] sm:border sm:bg-white/76 sm:p-4 sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.54)] sm:backdrop-blur dark:border-white/10 dark:bg-transparent dark:sm:border-white/8 dark:sm:bg-white/[0.045] dark:sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const walletInteractiveSurfaceClass =
  "relative overflow-hidden cursor-pointer border border-teal-500/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,252,0.93))] ring-1 ring-teal-500/12 shadow-[0_20px_42px_rgba(15,23,42,0.08)] transition duration-200 before:pointer-events-none before:absolute before:bottom-4 before:left-0 before:top-4 before:w-[3px] before:rounded-r-full before:bg-teal-600/40 hover:-translate-y-0.5 hover:border-teal-600/34 hover:bg-white dark:border-teal-400/18 dark:bg-[linear-gradient(180deg,rgba(19,28,37,0.96),rgba(13,20,29,0.94))] dark:ring-teal-400/14 dark:before:bg-teal-400/50 dark:hover:border-teal-300/32 dark:hover:bg-white/[0.08]";

export const walletActionRowClass =
  `${walletInteractiveSurfaceClass} group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 rounded-[22px] px-4 py-4 text-left`;

export const walletActionRowIconClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-500/18 bg-teal-50/85 text-teal-700 transition duration-200 group-hover:border-teal-600/34 group-hover:bg-teal-50 dark:border-teal-400/16 dark:bg-teal-400/12 dark:text-teal-200 dark:group-hover:bg-teal-400/18";

export const walletChoiceCardClass =
  `${walletInteractiveSurfaceClass} w-full rounded-[22px] p-4 text-left`;

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
