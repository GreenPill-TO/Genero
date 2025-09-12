import type { Config } from "tailwindcss";
import wallet from "./app/tcoin/wallet/tailwind.config";
import sparechange from "./app/tcoin/sparechange/tailwind.config";

const app = process.env.NEXT_PUBLIC_APP_NAME === "sparechange" ? "sparechange" : "wallet";

const config: Config = app === "sparechange" ? sparechange : wallet;

export default config;

