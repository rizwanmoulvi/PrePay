/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";

export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets: solanaWallets, createWallet } = useSolanaWallets();
  const creationAttempted = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    
    // Check if the user's profile already has a Solana wallet registered
    const hasSolanaWallet = user.linkedAccounts.some(
      (account: any) => account.type === 'wallet' && account.chainType === 'solana'
    );

    if (!hasSolanaWallet && !creationAttempted.current) {
      console.log("No Solana wallet found in user profile. Provisioning one...");
      creationAttempted.current = true;
      createWallet().catch((err) => {
        console.error(err);
        creationAttempted.current = false;
      });
    }
  }, [ready, authenticated, user, createWallet]);

  return <>{children}</>;
}
