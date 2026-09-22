import { Connection, PublicKey } from "@solana/web3.js";
async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const PROGRAM_ID = new PublicKey("AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS");
  const [globalConfigPda] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
  const info = await connection.getAccountInfo(globalConfigPda);
  console.log("Size:", info?.data.length);
}
main();
