import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import bs58 from "bs58";

async function main() {
  const secret = process.env.TEST_TOKEN_MINTER_SECRET?.replace(/"/g, "") || "";
  const wallet = Keypair.fromSecretKey(bs58.decode(secret));
  console.log("Checking balances for Wallet:", wallet.publicKey.toBase58());

  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const conn = new Connection(rpc);

  const tokens = ["OPENAI", "ANTHROPIC", "FIGUREAI", "ANDURIL", "NEURALINK", "KALSHI", "POLYMARKET"];
  
  for (const symbol of tokens) {
    const mintStr = process.env["NEXT_PUBLIC_TOKEN_" + symbol];
    if (!mintStr) continue;
    const mint = new PublicKey(mintStr);
    const ata = await getAssociatedTokenAddress(mint, wallet.publicKey);
    
    try {
      const accountInfo = await getAccount(conn, ata);
      const balance = Number(accountInfo.amount) / 1e6;
      console.log(`- ${symbol}: ${balance} tokens`);
    } catch (e) {
      console.log(`- ${symbol}: 0 tokens`);
    }
  }
}

main().catch(console.error);
