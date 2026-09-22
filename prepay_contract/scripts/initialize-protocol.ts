import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, setAuthority, AuthorityType, getMint } from "@solana/spl-token";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS");

async function main() {
  console.log("Setting up PrePay Protocol...");

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));

  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config_2")],
    PROGRAM_ID
  );

  console.log(`GlobalConfig PDA: ${globalConfigPda.toBase58()}`);

  let pusdMint: PublicKey;

  // Create the pUSD Mint
  console.log("Creating pUSD Mint...");
  try {
    pusdMint = await createMint(
        connection,
        adminKeypair,
        adminKeypair.publicKey, // temporary authority
        null, // no freeze authority
        6 // 6 decimals
    );
    console.log(`✅ pUSD Mint Created: ${pusdMint.toBase58()}`);
  } catch(e) {
      console.error("Failed to create mint", e);
      return;
  }

  try {
    const info = await connection.getAccountInfo(globalConfigPda);
    if (info) {
      console.log("⚠️ Protocol already initialized. GlobalConfig exists.");
      return;
    }

    console.log("Sending initialize instruction to contract...");
    
    // global:initialize sighash
    const discriminator = Buffer.from("afaf6d1f0d989bed", "hex");

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: globalConfigPda, isSigner: false, isWritable: true },
        { pubkey: pusdMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator
    });

    const tx = new Transaction().add(ix);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminKeypair.publicKey;
    
    tx.sign(adminKeypair);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig);
    
    console.log(`✅ Initialize Transaction Successful!`);
    console.log(`Signature: ${sig}`);

    // Transfer Mint Authority to the Global Config PDA
    console.log("Transferring Mint Authority to GlobalConfig PDA...");
    await setAuthority(
        connection,
        adminKeypair,
        pusdMint,
        adminKeypair.publicKey,
        AuthorityType.MintTokens,
        globalConfigPda
    );
    console.log(`✅ Mint Authority transferred!`);

    console.log(`\n🎉 Protocol fully initialized!`);
    console.log(`Update NEXT_PUBLIC_PUSD_MINT in your .env.local to: ${pusdMint.toBase58()}`);

  } catch (err) {
    console.error("❌ Initialization Failed:", err);
  }
}

main().catch(console.error);
