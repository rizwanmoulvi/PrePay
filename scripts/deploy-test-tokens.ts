import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import * as fs from "fs";
import bs58 from "bs58";

// PreStocks to mirror
const TOKENS_TO_CREATE = ["NEURALINK", "KALSHI", "POLYMARKET"];

async function main() {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  console.log(`Connecting to Solana network at ${rpcUrl}...`);
  const connection = new Connection(rpcUrl, "confirmed");

  let deployer = Keypair.generate();
  
  if (process.env.TEST_TOKEN_MINTER_SECRET) {
    console.log("Using provided TEST_TOKEN_MINTER_SECRET from environment...");
    // Strip quotes if any
    const secret = process.env.TEST_TOKEN_MINTER_SECRET.replace(/"/g, '');
    deployer = Keypair.fromSecretKey(bs58.decode(secret));
  } else {
    console.log("Generating new deployment keypair...");
    console.log(`Deployer Address: ${deployer.publicKey.toBase58()}`);
    console.log("Airdropping 1 SOL for deployment fees...");
    try {
      const airdropSignature = await connection.requestAirdrop(deployer.publicKey, 1 * LAMPORTS_PER_SOL);
      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: airdropSignature,
      });
      console.log("Airdrop confirmed!");
    } catch (err) {
      console.error("\n❌ Airdrop failed! Devnet faucet is heavily rate-limited right now.");
      console.error("To fix this, export a funded devnet keypair as an environment variable before running:");
      console.error('export TEST_TOKEN_MINTER_SECRET="[your,byte,array,private,key]"');
      console.error("Or run this script later when the faucet recovers.\n");
      process.exit(1);
    }
  }

  const results: Record<string, string> = {};

  for (const symbol of TOKENS_TO_CREATE) {
    console.log(`Deploying test token for ${symbol}...`);
    try {
      const mint = await createMint(
        connection,
        deployer,
        deployer.publicKey, // mintAuthority
        deployer.publicKey, // freezeAuthority
        6 // decimals
      );
      
      console.log(`✅ ${symbol} Mint: ${mint.toBase58()}`);
      results[symbol] = mint.toBase58();
    } catch (err) {
      console.error(`Failed to create mint for ${symbol}:`, err);
    }
  }

  console.log("\nDeployment Complete!");
  console.log("Writing to .env.local as reference...");
  
  let envString = "\n# PrePay Devnet Test Tokens\n";
  for (const [symbol, address] of Object.entries(results)) {
    envString += `NEXT_PUBLIC_TOKEN_${symbol}=${address}\n`;
  }
  
  fs.appendFileSync(".env.local", envString);
  console.log("Addresses saved to .env.local!");
}

main().catch(console.error);
