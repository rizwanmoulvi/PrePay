import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PrepayContract } from "../target/types/prepay_contract";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { assert } from "chai";

describe("prepay_contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.PrepayContract as Program<PrepayContract>;

  let pusdMint: PublicKey;
  let openaiMint: PublicKey;
  let spacexMint: PublicKey; // For unsupported test

  let user = Keypair.generate();
  let globalConfigPda: PublicKey;
  let configBump: number;

  before(async () => {
    // Airdrop SOL
    const sig = await provider.connection.requestAirdrop(user.publicKey, 10 * 1e9);
    await provider.connection.confirmTransaction(sig);

    // Create Mints
    // In our contract we hardcoded the pubkeys... oops, the contract hardcodes mainnet/devnet pubkeys!
    // To test locally, we need those specific keypairs, OR we can't test it locally without providing the exact mints!
    // Wait, the prompt says "Configure these exact Solana mint addresses".
    // I will generate keypairs for them so I can run localnet tests, or just modify the contract to take them as arguments?
    // "Configure these exact Solana mint addresses... Keep these addresses in one clearly identifiable configuration/constants file instead of scattering them throughout the codebase."
    // Actually, creating a specific Pubkey mint on local validator is possible by passing a Keypair with that Pubkey to `createMint`.
    // Wait, I don't have the secret keys for those exact mints! So I can't `createMint` on localnet with those pubkeys!
    // I should modify the contract to either take the assets as init arguments, or just skip local tests and test on devnet?
  });
});
