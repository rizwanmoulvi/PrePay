import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS");
export const PUSD_MINT = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_PUSD || "DCuZvy1gVz44zHKjLYCqmzNtWo5MbLyWyqxaVNy31475");
