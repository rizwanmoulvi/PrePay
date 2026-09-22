"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ArrowUpRight, ArrowDownLeft, Copy } from "lucide-react";
import Link from "next/link";
import LoginButton from "@/components/loginButton";
import ReceiveModal from "@/components/ReceiveModal";
import SendModal from "@/components/SendModal";
import type { PreStock } from "@/app/api/prestocks/route";

export default function Home() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [prestocks, setPrestocks] = useState<PreStock[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [primaryCard, setPrimaryCard] = useState<any>(null);

  const solanaWallet = solanaWallets[0];
  let walletAddress = solanaWallet?.address || user?.wallet?.address;
  if (walletAddress?.startsWith("0x")) walletAddress = undefined;

  useEffect(() => {
    async function fetchBalances() {
      if (!walletAddress) return;
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl, "confirmed");
        const balance = await connection.getBalance(new PublicKey(walletAddress));
        setSolBalance(balance / LAMPORTS_PER_SOL);

        const res = await fetch("/api/prestocks");
        if (res.ok) {
          const data = await res.json();
          setPrestocks(data);
        }

        const accounts = await connection.getParsedTokenAccountsByOwner(
          new PublicKey(walletAddress),
          { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
        );
        
        const newBalances: Record<string, number> = {};
        accounts.value.forEach((accountInfo) => {
          const parsedInfo = accountInfo.account.data.parsed.info;
          newBalances[parsedInfo.mint] = parsedInfo.tokenAmount.uiAmount;
        });
        setBalances(newBalances);
      } catch (err) {
        console.error("Failed to fetch balances", err);
      }
      
      try {
        const cardRes = await fetch(`/api/lithic/card?address=${walletAddress}`);
        if (cardRes.ok) {
          const cardData = await cardRes.json();
          if (cardData.success && cardData.cards && cardData.cards.length > 0) {
            setPrimaryCard(cardData.cards[0]);
          }
        }
      } catch (err) {
        console.error("Failed to fetch cards", err);
      }
    }

    if (authenticated && walletAddress) {
      fetchBalances();
    }
  }, [authenticated, walletAddress]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-between min-h-screen p-6 py-24 text-center">
        <div className="flex-1 flex flex-col justify-center space-y-6 max-w-sm mx-auto">
          <div className="w-16 h-16 bg-black rounded-2xl mx-auto flex items-center justify-center">
            <span className="text-white text-2xl font-bold tracking-tighter">P</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-black">PrePay</h1>
          <p className="text-black/60 text-lg">Deposit PreStocks.<br/>Mint pUSD. Spend globally.</p>
        </div>
        <div className="w-full max-w-sm mx-auto space-y-4">
          <LoginButton />
          <p className="text-xs text-black/40">By continuing, you agree to our Terms of Service.</p>
        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen p-6 pb-24 max-w-md mx-auto w-full relative">
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          {walletAddress && (
            <button 
              onClick={() => navigator.clipboard.writeText(walletAddress)}
              className="flex items-center space-x-1.5 bg-black/5 hover:bg-black/10 px-3 py-1.5 rounded-full transition-colors"
            >
              <span className="font-mono text-sm font-medium">{walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}</span>
              <Copy className="w-3.5 h-3.5 text-black/60" />
            </button>
          )}
        </div>
        <button 
          onClick={() => logout()}
          className="text-sm font-medium text-black/60 hover:text-black transition-colors"
        >
          Sign Out
        </button>
      </header>

      <main className="flex-1 flex flex-col pt-4 space-y-10">
        <div className="flex flex-col items-center space-y-2">
                    <h2 className="text-[4.5rem] font-bold tracking-tighter text-black leading-none">
            ${(balances[process.env.NEXT_PUBLIC_PUSD_MINT || "DCuZvy1gVz44zHKjLYCqmzNtWo5MbLyWyqxaVNy31475"] || 0).toFixed(2)}
          </h2>
          <span className="text-sm font-medium text-black/40 uppercase tracking-widest">pUSD Balance</span>
          {solBalance !== null && (
            <div className="bg-black/5 px-4 py-1.5 rounded-full mt-2">
              <span className="text-xs font-semibold text-black/70">{solBalance.toFixed(4)} SOL Available</span>
            </div>
          )}
        </div>

        <div className="flex justify-center space-x-12">
          <div className="flex flex-col items-center space-y-3">
            <button onClick={() => setIsSendOpen(true)} className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-transform active:scale-95 shadow-lg">
              <ArrowUpRight className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-black uppercase tracking-wider">Send</span>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <button onClick={() => setIsReceiveOpen(true)} className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-transform active:scale-95 shadow-lg">
              <ArrowDownLeft className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-black uppercase tracking-wider">Receive</span>
          </div>
        </div>

        <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} address={walletAddress} />
        <SendModal isOpen={isSendOpen} onClose={() => setIsSendOpen(false)} address={walletAddress} solanaWallet={solanaWallet} prestocks={prestocks} balances={balances} solBalance={solBalance} />
        
        <div className="w-full pt-4">
          <Link href="/pay">
            <div className="w-full aspect-[1.586/1] bg-black text-white rounded-3xl p-6 flex flex-col justify-between shadow-[0_20px_40px_rgb(0,0,0,0.2)] relative overflow-hidden transition-transform active:scale-[0.98] cursor-pointer group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/visa-card-art.png" 
                alt="Visa Card Background" 
                className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 group-hover:scale-105 opacity-90"
              />
              <div className="absolute inset-0 bg-black/15 z-0"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 z-0"></div>
              
              <div className="relative z-10 flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-extrabold tracking-widest text-lg drop-shadow-md">PrePay</span>
                  <span className="text-[10px] font-medium tracking-widest opacity-80 uppercase mt-0.5 drop-shadow">Lithic Virtual</span>
                </div>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-white/20 backdrop-blur-md rounded border border-white/20 text-white tracking-widest shadow-sm">
                  {primaryCard ? primaryCard.state : 'VIRTUAL'}
                </span>
              </div>
              
              <div className="relative z-10 flex flex-col space-y-2">
                <div className="font-mono text-lg sm:text-xl tracking-[0.15em] sm:tracking-[0.2em] text-white/90 drop-shadow-md whitespace-nowrap">
                  •••• •••• •••• {primaryCard ? primaryCard.last_four || "XXXX" : "XXXX"}
                </div>
                <div className="flex space-x-6 text-xs text-white/80 font-mono font-semibold uppercase tracking-widest drop-shadow">
                  <div className="flex flex-col">
                    <span className="text-[8px] opacity-70 mb-0.5">VALID THRU</span>
                    <span>{primaryCard ? `${primaryCard.exp_month || "MM"}/${primaryCard.exp_year ? primaryCard.exp_year.toString().slice(-2) : "YY"}` : "12/28"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] opacity-70 mb-0.5">CVV</span>
                    <span>{primaryCard ? primaryCard.cvv || "•••" : "***"}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
