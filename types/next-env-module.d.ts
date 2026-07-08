declare module "@next/env" {
  export function loadEnvConfig(
    dir: string,
    dev?: boolean,
    log?: false | { info?: (...args: unknown[]) => void; error?: (...args: unknown[]) => void },
    forceReload?: boolean
  ): {
    combinedEnv: NodeJS.ProcessEnv;
    loadedEnvFiles: Array<{
      path: string;
      contents: string;
      env: Record<string, string>;
    }>;
  };
}
