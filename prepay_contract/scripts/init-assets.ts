import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS");

const PRE_STOCKS = [
  { symbol: "ANDURIL", address: "ANDR111111111111111111111111111111111111111", ltv: 6000 },
  { symbol: "ANTHROPIC", address: "ANTH111111111111111111111111111111111111111", ltv: 6000 },
  { symbol: "FIGUREAI", address: "FIG1111111111111111111111111111111111111111", ltv: 6000 },
  { symbol: "KALSHI", address: "KAL1111111111111111111111111111111111111111", ltv: 6000 },
  { symbol: "NEURALINK", address: "NEUR111111111111111111111111111111111111111", ltv: 6000 },
  { symbol: "OPENAI", address: "OPEN111111111111111111111111111111111111111", ltv: 6000 },
  { symbol: "POLYMARKET", address: "POLY111111111111111111111111111111111111111", ltv: 6000 }
];

async function main() {
  console.log("Initializing PreStocks...");

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));

  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );

  const discriminator = Buffer.from("5135868ef3492ab3", "hex"); // add_asset sighash

  for (const stock of PRE_STOCKS) {
    console.log(`Adding ${stock.symbol}...`);
    const collateralMint = new PublicKey(stock.address);
    
    // Build instruction data: 8 byte discriminator + 32 byte mint + 2 byte ltv
    const data = Buffer.alloc(8 + 32 + 2);
    discriminator.copy(data, 0);
    collateralMint.toBuffer().copy(data, 8);
    data.writeUInt16LE(stock.ltv, 40);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: globalConfigPda, isSigner: false, isWritable: true }
      ],
      data: data
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = adminKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(adminKeypair);
    
    try {
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, "confirmed");
        console.log(`✅ ${stock.symbol} Added! Sig: ${sig}`);
    } catch(e) {
        console.error(`Failed to add ${stock.symbol}`, e);
    }
  }

  console.log("All assets configured!");
}

main().catch(console.error);
