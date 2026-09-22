/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */

import { PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROGRAM_ID } from "./program";

export async function buildDepositAndMintInstructions(
  program: Program<any>,
  user: PublicKey,
  collateralMint: PublicKey,
  collateralAmount: number, // raw amount
  pusdAmount: number,       // raw amount
  pusdMint: PublicKey,
  assetPrice: number        // raw amount scaled by 1e6
) {
  const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from("global_config_2")], PROGRAM_ID);
  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), user.toBuffer(), collateralMint.toBuffer()],
    PROGRAM_ID
  );

  const userCollateralAta = getAssociatedTokenAddressSync(collateralMint, user);
  const userPusdAta = getAssociatedTokenAddressSync(pusdMint, user);
  const collateralVault = getAssociatedTokenAddressSync(collateralMint, globalConfig, true);

  const ixInit = // @ts-ignore
  await program.methods.initUserPosition()
    .accounts({
      user,
      userPosition,
      collateralMint,
      globalConfig,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const ixDeposit = // @ts-ignore
  await program.methods.depositCollateral(new BN(collateralAmount))
    .accounts({
      user,
      globalConfig,
      userPosition,
      collateralMint,
      userCollateralAta,
      collateralVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const ixMint = // @ts-ignore
  await program.methods.mintPusd(new BN(pusdAmount), new BN(assetPrice))
    .accounts({
      user,
      globalConfig,
      userPosition,
      pusdMint,
      userPusdAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return { ixInit, ixDeposit, ixMint };
}

export async function buildRedeemInstructions(
  program: Program<any>,
  user: PublicKey,
  collateralMint: PublicKey,
  collateralAmount: number,
  pusdAmountToBurn: number,
  pusdMint: PublicKey,
  assetPrice: number        // raw amount scaled by 1e6
) {
  const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from("global_config_2")], PROGRAM_ID);
  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), user.toBuffer(), collateralMint.toBuffer()],
    PROGRAM_ID
  );

  const userCollateralAta = getAssociatedTokenAddressSync(collateralMint, user);
  const userPusdAta = getAssociatedTokenAddressSync(pusdMint, user);
  const collateralVault = getAssociatedTokenAddressSync(collateralMint, globalConfig, true);

  const ixBurn = // @ts-ignore
  await program.methods.burnPusd(new BN(pusdAmountToBurn))
    .accounts({
      user,
      globalConfig,
      userPosition,
      pusdMint,
      userPusdAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const ixWithdraw = // @ts-ignore
  await program.methods.withdrawCollateral(new BN(collateralAmount), new BN(assetPrice))
    .accounts({
      user,
      globalConfig,
      userPosition,
      userCollateralAta,
      collateralVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return { ixBurn, ixWithdraw };
}
