import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import bs58 from "bs58";

async function main() {
  const secret = process.env.TEST_TOKEN_MINTER_SECRET?.replace(/"/g, "") || "";
  if (!secret) {
    throw new Error("Missing TEST_TOKEN_MINTER_SECRET");
  }
  const wallet = Keypair.fromSecretKey(bs58.decode(secret));
  console.log("Wallet:", wallet.publicKey.toBase58());

  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const conn = new Connection(rpc, "confirmed");

  const tokens = ["OPENAI", "ANTHROPIC", "FIGUREAI", "ANDURIL", "NEURALINK", "KALSHI", "POLYMARKET"];
  
  for (const symbol of tokens) {
    const mintStr = process.env["NEXT_PUBLIC_TOKEN_" + symbol];
    if (!mintStr) continue;
    
    const mint = new PublicKey(mintStr);
    
    console.log(`Minting 1000 ${symbol}...`);
    try {
      // 1. Get or create Associated Token Account for our wallet
      const ata = await getOrCreateAssociatedTokenAccount(
        conn,
        wallet, // payer
        mint, // mint
        wallet.publicKey // owner
      );

      // 2. Mint 1,000 tokens (with 6 decimals)
      const amountToMint = 1000 * 1_000_000;
      await mintTo(
        conn,
        wallet, // payer
        mint, // mint
        ata.address, // destination
        wallet.publicKey, // authority
        amountToMint
      );
      
      console.log(`✅ Minted 1000 ${symbol} to ${ata.address.toBase58()}`);
    } catch (err) {
      console.error(`❌ Failed to mint ${symbol}:`, err);
    }
  }
}

main().catch(console.error);
