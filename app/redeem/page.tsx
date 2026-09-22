/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PreStock } from "@/app/api/prestocks/route";

export default function RedeemPage() {
  const router = useRouter();
  const { user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const solanaWallet = solanaWallets[0];
  let walletAddress = solanaWallet?.address || user?.wallet?.address;
  if (walletAddress?.startsWith("0x")) walletAddress = undefined;

  const [positions, setPositions] = useState<any[]>([]);
  const [prestocks, setPrestocks] = useState<PreStock[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedPosIds, setSelectedPosIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"INPUT" | "SUCCESS">("INPUT");
  const [txStatus, setTxStatus] = useState("");

  useEffect(() => {
    async function load() {
      if (!walletAddress) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/prestocks");
        if (res.ok) setPrestocks(await res.json());

        const { Connection, PublicKey } = await import("@solana/web3.js");
        const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
        const { IDL } = await import("@/lib/prepay/idl");

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
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [walletAddress]);

  const toggleSelection = (id: string) => {
    setSelectedPosIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedPosIds.length === positions.length) {
      setSelectedPosIds([]);
    } else {
      setSelectedPosIds(positions.map(p => p.publicKey.toBase58()));
    }
  };

  const handleRedeem = async () => {
    if (!walletAddress || selectedPosIds.length === 0) return;
    
    const selectedPositions = positions.filter(p => selectedPosIds.includes(p.publicKey.toBase58()));
    if (selectedPositions.length === 0) return;
    
    setIsProcessing(true);
    setTxStatus("Preparing transactions...");
    try {
      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
      const { IDL } = await import("@/lib/prepay/idl");
      const { PROGRAM_ID, PUSD_MINT } = await import("@/lib/prepay/program");
      const { buildRedeemInstructions } = await import("@/lib/prepay/instructions");

      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const conn = new Connection(rpcUrl, "confirmed");
      const userPubkey = new PublicKey(walletAddress);
      
      const anyWallet = solanaWallet as any;
      const provider = new AnchorProvider(conn, anyWallet, { commitment: "confirmed" });
      const program = new Program(IDL as any, provider);

      // Chunk into 2 assets per transaction to prevent exceeding size limits
      const chunks: typeof selectedPositions[] = [];
      let cur: typeof selectedPositions = [];
      for (const pos of selectedPositions) {
        cur.push(pos);
        if (cur.length >= 2) {
            chunks.push(cur);
            cur = [];
        }
      }
      if (cur.length > 0) chunks.push(cur);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunks.length > 1) {
          setTxStatus(`Closing position ${i + 1} of ${chunks.length} ⏳`);
        } else {
          setTxStatus("Repaying pUSD and unlocking collateral...");
        }

        const tx = new Transaction();

        for (const pos of chunk) {
          const mintPubkey = new PublicKey(pos.collateralMint);
          const stock = prestocks.find(s => s.tokenAddress === mintPubkey.toBase58());
          const assetPriceRaw = Math.floor((stock?.price || 100) * 1_000_000);

          const pusdBurnRaw = pos.debt;
          const collateralWithdrawRaw = pos.collateralAmount;

          const { ixBurn, ixWithdraw } = await buildRedeemInstructions(
            program, userPubkey, mintPubkey, collateralWithdrawRaw, pusdBurnRaw, PUSD_MINT, assetPriceRaw
          );

          if (pusdBurnRaw > 0) tx.add(ixBurn);
          if (collateralWithdrawRaw > 0) tx.add(ixWithdraw);
        }

        const latestBlockhash = await conn.getLatestBlockhash();
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = userPubkey;

        let signature;
        if (anyWallet.sendTransaction) {
          const sendOptions = { uiOptions: { fundTx: false } };
          try {
            signature = await anyWallet.sendTransaction(tx, conn, sendOptions);
          } catch(e) {
            signature = await anyWallet.sendTransaction(tx, conn);
          }
          if (typeof signature === 'object' && signature !== null && 'signature' in signature) {
             signature = signature.signature;
          }
        } else if (anyWallet.signAndSendTransaction) {
          const res = await anyWallet.signAndSendTransaction(tx);
          signature = res.signature;
        } else {
          throw new Error("Wallet does not support sending transactions");
        }
        
        await conn.confirmTransaction({ signature, ...latestBlockhash });
      }

      setStep("SUCCESS");
    } catch (err: any) {
      console.error(err);
      alert("Redeem Failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "SUCCESS") {
    return (
      <div className="flex flex-col min-h-screen bg-[#F9F9F9] max-w-md mx-auto w-full p-6 justify-center items-center text-center space-y-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Positions Closed!</h2>
        <p className="text-black/60">
          You have successfully repaid your debt and unlocked your collateral for the selected positions.
        </p>
        <button 
          onClick={() => router.push("/pusd")}
          className="w-full py-4 bg-black text-white font-bold rounded-2xl mt-8"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F9F9F9] max-w-md mx-auto w-full relative">
      <header className="flex items-center p-6 bg-white border-b border-black/5 shrink-0">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold ml-2">Close Positions</h1>
      </header>

      <main className="flex-1 p-6 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm text-black/60">Select positions to close:</p>
          {!loading && positions.length > 0 && (
            <button 
              onClick={toggleAll}
              className="text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
            >
              {selectedPosIds.length === positions.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-6 text-center text-black/40 text-sm">Loading positions...</div>
        ) : positions.length === 0 ? (
          <div className="p-6 border border-black/10 bg-black/5 rounded-3xl flex flex-col items-center text-center space-y-2">
            <span className="font-medium text-black/60 text-sm">No active positions</span>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((pos) => {
              const mint = pos.collateralMint;
              const stock = prestocks.find(s => s.tokenAddress === mint);
              const colAmount = pos.collateralAmount / 1_000_000;
              const debt = pos.debt / 1_000_000;
              const pubkeyStr = pos.pubkey;
              const isSelected = selectedPosIds.includes(pubkeyStr);

              return (
                <button
                  key={pubkeyStr}
                  onClick={() => toggleSelection(pubkeyStr)}
                  className={`w-full text-left p-5 rounded-3xl border transition-colors shadow-sm ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-black border-black/10 hover:border-black/30'}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-lg">{stock?.symbol || 'Unknown'}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-white' : 'border-black/20'}`}>
                       {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <div className="flex justify-between items-center opacity-80">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold tracking-wider mb-0.5">Debt</span>
                      <span className="font-semibold">{debt.toFixed(2)} pUSD</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider mb-0.5">Collateral</span>
                      <span className="font-semibold">{colAmount.toFixed(2)} shares</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <div className="p-6 shrink-0 sticky bottom-0 bg-gradient-to-t from-[#F9F9F9] via-[#F9F9F9] to-transparent pt-12">
        <button
          onClick={handleRedeem}
          disabled={selectedPosIds.length === 0 || isProcessing}
          className="w-full py-4 bg-black text-white font-bold rounded-3xl disabled:opacity-50 transition-transform active:scale-[0.98] shadow-lg shadow-black/10 flex flex-col items-center justify-center"
        >
          {isProcessing ? (
             <span className="text-sm">{txStatus}</span>
          ) : (
             `Repay & Close ${selectedPosIds.length > 0 ? selectedPosIds.length : ''} Position${selectedPosIds.length > 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
}
