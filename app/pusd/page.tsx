/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Clock } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import type { PreStock } from "@/app/api/prestocks/route";

export default function PusdHub() {
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const solanaWallet = wallets[0];
  let walletAddress = solanaWallet?.address || user?.wallet?.address;
  if (walletAddress?.startsWith("0x")) walletAddress = undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [positions, setPositions] = useState<any[]>([]);
  const [prestocks, setPrestocks] = useState<PreStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!walletAddress) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/prestocks");
        if (res.ok) {
          setPrestocks(await res.json());
        }

        const { Connection, PublicKey } = await import("@solana/web3.js");
        const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
        const { IDL } = await import("@/lib/prepay/idl");
        const { PROGRAM_ID } = await import("@/lib/prepay/program");

        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const conn = new Connection(rpcUrl, "confirmed");
        
        let pubkey;
        try {
            pubkey = new PublicKey(walletAddress);
        } catch (e) {
            console.error("Invalid Solana address:", walletAddress);
            setLoading(false);
            return;
        }
        
        const dummyProvider = new AnchorProvider(conn, {} as any, { commitment: "confirmed" });
        const program = new Program(IDL as any, dummyProvider);
        
        const allPositions = await (program.account as any).userPosition.all([
          { memcmp: { offset: 8, bytes: pubkey.toBase58() } }
        ]);
        
        
        setPositions(allPositions.filter((p: any) => p.account.collateralAmount.toNumber() > 0));
        
        // Fetch history
        try {
            const hRes = await fetch(`/api/history?address=${walletAddress}`);
            const hData = await hRes.json();
            if (hData.success) {
                setHistory(hData.history);
            }
        } catch (e) {
            console.error("History fetch error:", e);
        } finally {
            setHistoryLoading(false);
        }

      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [walletAddress]);

  return (
    <div className="flex flex-col min-h-screen p-6 pb-24 max-w-md mx-auto w-full relative bg-[#F9F9F9]">
      <header className="mb-8 mt-4">
        <h1 className="text-3xl font-bold tracking-tight">pUSD Hub</h1>
        <p className="text-sm text-black/60 mt-1">Manage your collateralized stablecoins</p>
      </header>

      <main className="flex-1 space-y-8">
        {/* Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/mint" className="flex flex-col items-center justify-center p-6 bg-black text-white rounded-3xl hover:bg-black/80 transition-transform active:scale-95 shadow-md">
            <ArrowDownToLine className="w-8 h-8 mb-3" />
            <span className="font-bold tracking-wide">Mint pUSD</span>
          </Link>
          
          <Link href="/redeem" className="flex flex-col items-center justify-center p-6 bg-white border border-black/10 text-black rounded-3xl hover:bg-black/5 transition-transform active:scale-95 shadow-sm">
            <ArrowUpFromLine className="w-8 h-8 mb-3" />
            <span className="font-bold tracking-wide">Redeem</span>
          </Link>
        </div>

        {/* Existing Positions */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Active Positions</h2>
          
          {loading ? (
             <div className="p-6 text-center text-black/40 text-sm">Loading...</div>
          ) : positions.length === 0 ? (
            <div className="p-6 border border-black/10 bg-black/5 rounded-3xl flex flex-col items-center text-center space-y-2">
              <span className="font-medium text-black/60 text-sm">No active positions</span>
              <p className="text-xs text-black/40">Mint pUSD against your PreStocks to open a position.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {positions.map((pos, i) => {
                const mint = pos.collateralMint;
                const stock = prestocks.find(s => s.tokenAddress === mint);
                const colAmount = pos.collateralAmount / 1_000_000;
                const debt = pos.debt / 1_000_000;
                
                return (
                  <div key={i} className="p-5 bg-white border border-black/10 rounded-3xl shadow-sm flex flex-col space-y-3">
                    <div className="flex justify-between items-center border-b border-black/5 pb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">{stock?.symbol.charAt(0) || '?'}</span>
                        </div>
                        <span className="font-bold">{stock?.symbol || 'Unknown'}</span>
                      </div>
                      <div className="text-right flex flex-col">
                         <span className="text-sm font-bold text-red-600">-{debt.toFixed(2)} pUSD</span>
                         <span className="text-[10px] text-black/40 uppercase font-bold tracking-wider">Debt</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <div className="flex flex-col">
                        <span className="text-xs text-black/40 uppercase font-bold tracking-wider mb-0.5">Collateral</span>
                        <span className="font-semibold text-sm">{colAmount.toFixed(2)} {stock?.symbol}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* History */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">History</h2>
            <Clock className="w-4 h-4 text-black/40" />
          </div>
          
          <div className="space-y-3">
            {historyLoading ? (
  <div className="py-4 text-center text-sm text-black/40">Loading history...</div>
) : history.length === 0 ? (
  <div className="py-4 border-t border-black/5 flex justify-between items-center opacity-50">
    <div className="flex flex-col">
      <span className="text-sm font-medium">No transactions yet</span>
      <span className="text-xs text-black/60">Mint or redeem to see history</span>
    </div>
  </div>
) : (
  <div className="space-y-3">
    {history.map((item, i) => (
      <div key={i} className="p-4 bg-white border border-black/10 rounded-2xl flex flex-col space-y-2 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm">{item.action}</span>
          <span className="text-xs text-black/40">
            {new Date(item.blockTime * 1000).toLocaleDateString()}
          </span>
        </div>
        
        {item.pusdDelta !== 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-black/60">pUSD</span>
            <span className={`font-semibold ${item.pusdDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {item.pusdDelta > 0 ? '+' : ''}{item.pusdDelta.toFixed(2)} pUSD
            </span>
          </div>
        )}
        
        {Object.entries(item.assetDeltas).map(([mint, delta]: any) => {
          const stock = prestocks.find(s => s.tokenAddress === mint);
          if (!stock) return null;
          return (
            <div key={mint} className="flex justify-between items-center text-xs border-t border-black/5 pt-1 mt-1">
              <span className="text-black/60">{stock.symbol}</span>
              <span className={`font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(2)} shares
              </span>
            </div>
          );
        })}
        
        <a 
          href={`https://explorer.solana.com/tx/${item.signature}?cluster=devnet`}
          target="_blank" 
          rel="noreferrer"
          className="text-[10px] text-blue-500 hover:underline pt-2"
        >
          View on Explorer
        </a>
      </div>
    ))}
  </div>
)}
          </div>
        </section>
      </main>
    </div>
  );
}
