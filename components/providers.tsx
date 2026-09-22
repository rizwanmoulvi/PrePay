"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { SolanaWalletProvider } from "./SolanaWalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={{
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(
                process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
              ),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                "wss://api.devnet.solana.com",
              ),
            },
          },
        },
        appearance: {
          theme: "light",
          showWalletLoginFirst: true,
          walletChainType: "solana-only",
        },
        loginMethods: ["email", "google", "wallet"],
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        embeddedWallets: {
          createOnLogin: "all-users",
        },
        fundingMethodConfig: {
          moonpay: {
            useSandbox: true,
          },
        },
      }}
    >
      <SolanaWalletProvider>
        {children}
      </SolanaWalletProvider>
    </PrivyProvider>
  );
}
