export const formFieldSurfaceClass =
  "wallet-auth-input border border-input bg-slate-50/92 text-foreground shadow-sm transition-colors dark:border-white/10 dark:bg-slate-950/55";

export const inputFieldClass =
  `${formFieldSurfaceClass} flex h-9 w-full rounded-md px-3 py-1 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`;

export const textareaFieldClass =
  `${formFieldSurfaceClass} flex min-h-[60px] w-full rounded-md px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`;

export const selectTriggerFieldClass =
  `${formFieldSurfaceClass} flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1`;

export const nativeFieldClass =
  `${formFieldSurfaceClass} w-full rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`;

export const reactSelectFieldShellClass =
  `${formFieldSurfaceClass} w-full rounded-md`;

export const fileInputFieldClass =
  `${nativeFieldClass} file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background hover:file:opacity-90 dark:file:bg-white dark:file:text-slate-950`;

export const otpDigitFieldClass =
  `${formFieldSurfaceClass} h-10 w-10 rounded-md text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-slate-300/80 dark:bg-slate-100 dark:text-slate-950`;

export const authModalEmailFieldClass =
  `${inputFieldClass} bg-white border-slate-300 text-slate-950 placeholder:text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.08)] focus-visible:border-[#05656F] focus-visible:ring-[#05656F]/30 dark:border-slate-300/80 dark:bg-slate-100 dark:text-slate-950 dark:placeholder:text-slate-500 dark:shadow-none`;
