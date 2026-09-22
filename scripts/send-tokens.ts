import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import bs58 from "bs58";

async function main() {
  const secret = process.env.TEST_TOKEN_MINTER_SECRET?.replace(/"/g, "") || "";
  if (!secret) throw new Error("Missing TEST_TOKEN_MINTER_SECRET");
  
  const fromWallet = Keypair.fromSecretKey(bs58.decode(secret));
  const toAddress = new PublicKey("CUuMgATEPWRbcfLEHSiXwBNYvbrLJPf2cNNJzxugouvb");

  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const conn = new Connection(rpc, "confirmed");

  // console.log(`Sending 1 SOL from ${fromWallet.publicKey.toBase58()} to ${toAddress.toBase58()}...`);
  // try {
  //   const tx = new Transaction().add(
  //     SystemProgram.transfer({
  //       fromPubkey: fromWallet.publicKey,
  //       toPubkey: toAddress,
  //       lamports: 1 * LAMPORTS_PER_SOL,
  //     })
  //   );
  //   const sig = await sendAndConfirmTransaction(conn, tx, [fromWallet]);
  //   console.log(`✅ Sent 1 SOL. Tx: ${sig}`);
  // } catch (err) {
  //   console.error("❌ Failed to send SOL:", err);
  // }

  const tokens = ["OPENAI", "ANTHROPIC", "FIGUREAI", "ANDURIL", "NEURALINK", "KALSHI", "POLYMARKET"];
  
  for (const symbol of tokens) {
    const mintStr = process.env["NEXT_PUBLIC_TOKEN_" + symbol];
    if (!mintStr) continue;
    
    const mint = new PublicKey(mintStr);
    
    console.log(`Sending 5 ${symbol}...`);
    try {
      // 1. Get from ATA
      const fromAta = await getOrCreateAssociatedTokenAccount(
        conn,
        fromWallet,
        mint,
        fromWallet.publicKey
      );

      // 2. Get or create to ATA
      const toAta = await getOrCreateAssociatedTokenAccount(
        conn,
        fromWallet, // payer for rent
        mint,
        toAddress
      );

      // 3. Transfer 500 tokens (6 decimals)
      const amount = 500 * 1_000_000;
      const sig = await transfer(
        conn,
        fromWallet, // payer
        fromAta.address, // from
        toAta.address, // to
        fromWallet.publicKey, // authority
        amount
      );
      
      console.log(`✅ Sent 500 ${symbol}. Tx: ${sig}`);
    } catch (err) {
      console.error(`❌ Failed to send ${symbol}:`, err);
    }
  }
}

main().catch(console.error);
