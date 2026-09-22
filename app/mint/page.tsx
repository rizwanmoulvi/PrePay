/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { getLtvForSymbol } from "@/lib/risk";
import type { PreStock } from "@/app/api/prestocks/route";

export default function MintPage() {
  const router = useRouter();
  const { user, authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  
  const [mintMode, setMintMode] = useState<"PUSD" | "STOCK">("PUSD");
  const [step, setStep] = useState<"BUILDER" | "SUCCESS">("BUILDER");
  
  // State for PUSD mode
  const [desiredPusdStr, setDesiredPusdStr] = useState<string>("");
  const [collateralAmounts, setCollateralAmounts] = useState<Record<string, string>>({});
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);
  
  // State for STOCK mode
  const [selectedStockIdModeB, setSelectedStockIdModeB] = useState<string | null>(null);
  const [stockQuantityStr, setStockQuantityStr] = useState<string>("");
  const [pusdToMintStr, setPusdToMintStr] = useState<string>("");
  
  const [prestocks, setPrestocks] = useState<PreStock[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  const solanaWallet = solanaWallets.find((w) => w.address === user?.wallet?.address) || solanaWallets[0];
  let walletAddress = solanaWallet?.address || user?.wallet?.address;
  if (walletAddress?.startsWith("0x")) walletAddress = undefined;

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/prestocks");
        if (res.ok) {
          const data = await res.json();
          setPrestocks(data);
          if (data.length > 0) setSelectedStockIdModeB(data[0].id);
        }

        if (walletAddress) {
          const { Connection, PublicKey } = await import("@solana/web3.js");
          const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
          const connection = new Connection(rpcUrl, "confirmed");
          const accounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(walletAddress),
            { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
          );
          
          const newBalances: Record<string, number> = {};
          accounts.value.forEach((acc) => {
            const parsed = acc.account.data.parsed.info;
            if (parsed.tokenAmount.uiAmount > 0) {
              newBalances[parsed.mint] = parsed.tokenAmount.uiAmount;
            }
          });
          setBalances(newBalances);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
  }, [walletAddress]);

  // Derived logic for PUSD Mode (Multi-Collateral)
  const desiredPusd = parseFloat(desiredPusdStr) || 0;
  
  const getAssetMaxPusd = (stockId: string, qtyStr: string) => {
    const qty = parseFloat(qtyStr) || 0;
    const stock = prestocks.find(s => s.id === stockId);
    if (!stock) return 0;
    return qty * stock.price * getLtvForSymbol(stock.symbol);
  };

  const totalProvidedPusd = useMemo(() => {
    return Object.entries(collateralAmounts).reduce((sum, [id, qty]) => sum + getAssetMaxPusd(id, qty), 0);
  }, [collateralAmounts, prestocks]);

  const pusdModeValid = desiredPusd > 0 && totalProvidedPusd >= desiredPusd;

  const toggleExpandPusdAsset = (assetId: string) => {
    if (expandedStockId === assetId) {
      setExpandedStockId(null);
    } else {
      setExpandedStockId(assetId);
      // Auto-fill logic
      if (!collateralAmounts[assetId]) {
        const remainingToFill = Math.max(0, desiredPusd - totalProvidedPusd);
        if (remainingToFill > 0) {
          const stock = prestocks.find(s => s.id === assetId);
          if (stock) {
            const requiredQty = remainingToFill / getLtvForSymbol(stock.symbol) / stock.price;
            const autoFill = Math.min(requiredQty, balances[stock.tokenAddress] || 0);
            setCollateralAmounts(prev => ({ ...prev, [assetId]: (Math.ceil(autoFill * 100) / 100).toString() }));
          }
        }
      }
    }
  };


  const handleAutoAllocateEqually = () => {
    const availableAssets = prestocks.filter(a => (balances[a.tokenAddress] || 0) > 0);
    if (availableAssets.length === 0 || desiredPusd <= 0) return;
    
    let remainingPusd = desiredPusd;
    const pool = [...availableAssets];
    
    // Sort pool by max pusd capacity ascending to fill smallest first
    pool.sort((a, b) => {
        const aMax = (balances[a.tokenAddress] || 0) * a.price * getLtvForSymbol(a.symbol);
        const bMax = (balances[b.tokenAddress] || 0) * b.price * getLtvForSymbol(b.symbol);
        return aMax - bMax;
    });

    const newAmounts = { ...collateralAmounts };
    for (const a of availableAssets) {
        newAmounts[a.id] = "0"; // initialize all to 0
    }

    while (pool.length > 0 && remainingPusd > 0.001) {
        const targetPerAsset = remainingPusd / pool.length;
        const currentAsset = pool.shift();
        if (!currentAsset) continue;
        
        const assetMaxPusd = (balances[currentAsset.tokenAddress] || 0) * currentAsset.price * getLtvForSymbol(currentAsset.symbol);
        
        const allocatePusd = Math.min(targetPerAsset, assetMaxPusd);
        const requiredQty = allocatePusd / getLtvForSymbol(currentAsset.symbol) / currentAsset.price;
        newAmounts[currentAsset.id] = (Math.ceil(requiredQty * 100) / 100).toString();
        remainingPusd -= allocatePusd;
    }
    
    setCollateralAmounts(newAmounts);
  };

  // Derived logic for STOCK Mode
  const selectedStockModeB = prestocks.find(s => s.id === selectedStockIdModeB);
  const stockModeLtv = selectedStockModeB ? getLtvForSymbol(selectedStockModeB.symbol) : 0;
  const stockQuantity = parseFloat(stockQuantityStr) || 0;
  const stockModeMaxPusd = selectedStockModeB ? stockQuantity * selectedStockModeB.price * stockModeLtv : 0;
  const pusdToMint = parseFloat(pusdToMintStr) || 0;
  const stockModeValid = stockQuantity > 0 && selectedStockModeB && stockQuantity <= (balances[selectedStockModeB.tokenAddress] || 0) && pusdToMint > 0 && pusdToMint <= stockModeMaxPusd;

  const handleMint = async () => {
    if (!walletAddress) return;
    
    setIsProcessing(true);
    setTxStatus("Preparing transaction ⏳");

    try {
      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } = await import("@solana/spl-token");
      const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
      const { IDL } = await import("@/lib/prepay/idl");
      const { PROGRAM_ID } = await import("@/lib/prepay/program");
      const { buildDepositAndMintInstructions } = await import("@/lib/prepay/instructions");
      
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const conn = new Connection(rpcUrl, "confirmed");
      const userPubkey = new PublicKey(walletAddress);
      const PUSD_MINT = new PublicKey(process.env.NEXT_PUBLIC_PUSD_MINT || "DCuZvy1gVz44zHKjLYCqmzNtWo5MbLyWyqxaVNy31475");
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyWallet = solanaWallet as any;
      const provider = new AnchorProvider(conn, anyWallet, { commitment: "confirmed" });
      const program = new Program(IDL as any, provider);
      
      const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from("global_config_2")], PROGRAM_ID);

      const sendTx = async (tx: typeof Transaction.prototype) => {
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
      };

      if (mintMode === "PUSD") {
        const entries = Object.entries(collateralAmounts).filter(([_, qtyStr]) => parseFloat(qtyStr) > 0);
        if (entries.length === 0) return;
        
        // Chunk into 2 assets per transaction to avoid limits
        const chunks: typeof entries[] = [];
        let cur: typeof entries = [];
        for (const entry of entries) {
            cur.push(entry);
            if (cur.length >= 2) {
                chunks.push(cur);
                cur = [];
            }
        }
        if (cur.length > 0) chunks.push(cur);

        let isPusdAtaCreatedInCurrentTx = false;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (chunks.length > 1) {
             setTxStatus(`Minting ${i + 1} of ${chunks.length} ⏳`);
          } else {
             setTxStatus("1. Depositing collateral \n2. Minting pUSD ⏳");
          }
          
          const tx = new Transaction();
          
          const userPusdAta = getAssociatedTokenAddressSync(PUSD_MINT, userPubkey);
          const userPusdAtaInfo = await conn.getAccountInfo(userPusdAta);
          if (!userPusdAtaInfo && !isPusdAtaCreatedInCurrentTx) {
            tx.add(createAssociatedTokenAccountInstruction(userPubkey, userPusdAta, userPubkey, PUSD_MINT));
            isPusdAtaCreatedInCurrentTx = true;
          }

          for (const [id, qtyStr] of chunk) {
            const qty = parseFloat(qtyStr);
            const stock = prestocks.find(s => s.id === id);
            if (!stock) continue;
            
            const mintPubkey = new PublicKey(stock.tokenAddress);
            const ltv = getLtvForSymbol(stock.symbol);
            const amountBase = Math.floor(qty * 1_000_000);
            const assetPriceRaw = Math.floor(stock.price * 1_000_000);
            const valueUsd = (BigInt(amountBase) * BigInt(assetPriceRaw)) / BigInt(1_000_000);
            const pusdRaw = Number((valueUsd * BigInt(Math.round(ltv * 10000))) / BigInt(10000));

            const { ixInit, ixDeposit, ixMint } = await buildDepositAndMintInstructions(
              program, userPubkey, mintPubkey, amountBase, pusdRaw, PUSD_MINT, assetPriceRaw
            );
            
            const collateralVault = getAssociatedTokenAddressSync(mintPubkey, globalConfig, true);
            const collateralVaultInfo = await conn.getAccountInfo(collateralVault);
            if (!collateralVaultInfo) {
              tx.add(createAssociatedTokenAccountInstruction(userPubkey, collateralVault, globalConfig, mintPubkey));
            }

            const [userPosition] = PublicKey.findProgramAddressSync(
              [Buffer.from("position"), userPubkey.toBuffer(), mintPubkey.toBuffer()],
              PROGRAM_ID
            );
            const positionInfo = await conn.getAccountInfo(userPosition);
            if (!positionInfo) {
              tx.add(ixInit);
            }

            tx.add(ixDeposit);
            tx.add(ixMint);
          }
          
          await sendTx(tx);
        }
      } else {
        if (!selectedStockModeB || stockQuantity <= 0) return;
        setTxStatus("1. Depositing collateral \n2. Minting pUSD ⏳");
        
        const tx = new Transaction();
        const mintPubkey = new PublicKey(selectedStockModeB.tokenAddress);
        const amountBase = Math.floor(stockQuantity * 1_000_000);
        
        let pusdRaw = Math.floor(pusdToMint * 1_000_000);
        const assetPriceRaw = Math.floor(selectedStockModeB.price * 1_000_000);
        
        // Cap pusdRaw to max_debt to prevent InsufficientCollateral error due to floating point precision
        const ltv = getLtvForSymbol(selectedStockModeB.symbol);
        const valueUsd = (BigInt(amountBase) * BigInt(assetPriceRaw)) / BigInt(1_000_000);
        const maxDebt = Number((valueUsd * BigInt(Math.round(ltv * 10000))) / BigInt(10000));
        if (pusdRaw > maxDebt) {
           pusdRaw = maxDebt;
        }

        const { ixInit, ixDeposit, ixMint } = await buildDepositAndMintInstructions(
          program, userPubkey, mintPubkey, amountBase, pusdRaw, PUSD_MINT, assetPriceRaw
        );
        
        const collateralVault = getAssociatedTokenAddressSync(mintPubkey, globalConfig, true);
        const collateralVaultInfo = await conn.getAccountInfo(collateralVault);
        if (!collateralVaultInfo) {
          tx.add(createAssociatedTokenAccountInstruction(userPubkey, collateralVault, globalConfig, mintPubkey));
        }

        const userPusdAta = getAssociatedTokenAddressSync(PUSD_MINT, userPubkey);
        const userPusdAtaInfo = await conn.getAccountInfo(userPusdAta);
        if (!userPusdAtaInfo) {
          tx.add(createAssociatedTokenAccountInstruction(userPubkey, userPusdAta, userPubkey, PUSD_MINT));
        }

        const [userPosition] = PublicKey.findProgramAddressSync(
          [Buffer.from("position"), userPubkey.toBuffer(), mintPubkey.toBuffer()],
          PROGRAM_ID
        );
        const positionInfo = await conn.getAccountInfo(userPosition);
        if (!positionInfo) {
          tx.add(ixInit);
        }

        tx.add(ixDeposit);
        tx.add(ixMint);
        
        await sendTx(tx);
      }
      
      setStep("SUCCESS");
    } catch (err) {
      console.error(err);
      alert("Transaction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  if (step === "SUCCESS") {
    const finalPusd = mintMode === "PUSD" ? desiredPusd : pusdToMint;

    return (
      <div className="flex flex-col min-h-screen bg-[#F9F9F9] max-w-md mx-auto w-full p-6 justify-center items-center text-center space-y-6">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Mint Successful!</h2>
        <p className="text-black/60">
          You have successfully minted <span className="font-bold text-black">${finalPusd.toFixed(2)} pUSD</span> using your PreStock collateral.
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
        <h1 className="text-xl font-bold ml-2">Mint pUSD</h1>
      </header>

      <div className="p-6 shrink-0 bg-white border-b border-black/5">
        <div className="flex p-1 bg-black/5 rounded-full relative">
          <button 
            onClick={() => { setMintMode("PUSD"); setSelectedStockIdModeB(null); setPusdToMintStr(""); setStockQuantityStr(""); }}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors z-10 ${mintMode === "PUSD" ? "text-white" : "text-black/60 hover:text-black"}`}
          >
            By pUSD Amount
          </button>
          <button 
            onClick={() => { setMintMode("STOCK"); setDesiredPusdStr(""); setCollateralAmounts({}); setExpandedStockId(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-colors z-10 ${mintMode === "STOCK" ? "text-white" : "text-black/60 hover:text-black"}`}
          >
            By Stock Amount
          </button>
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-black rounded-full transition-transform duration-200 ease-out ${mintMode === "STOCK" ? "translate-x-full left-1" : "left-1"}`} />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col space-y-4">
        {mintMode === "PUSD" ? (
          <>
            {/* BOX 1: Desired pUSD */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">You receive (pUSD)</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center w-full">
                  <span className="text-3xl font-bold text-black/30 mr-1">$</span>
                  <input
                    type="number"
                    value={desiredPusdStr}
                    onChange={(e) => setDesiredPusdStr(e.target.value)}
                    placeholder="0.00"
                    className="text-4xl font-bold bg-transparent border-none outline-none w-full placeholder:text-black/20"
                  />
                </div>
              </div>
            </div>

            {/* List of Collateral Cards */}
            {desiredPusd > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col space-y-3 px-1 mb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">You deposit (Select Multiple)</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${totalProvidedPusd >= desiredPusd ? 'text-green-600' : 'text-black/40'}`}>
                      {totalProvidedPusd >= desiredPusd ? 'Sufficient' : 'Need more'}
                    </span>
                  </div>
                  <button 
                    onClick={handleAutoAllocateEqually}
                    className="w-full py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                  >
                    Auto Allocate Equally
                  </button>
                </div>
                
                {prestocks.filter(a => (balances[a.tokenAddress] || 0) > 0).map(asset => {
                  const isExpanded = expandedStockId === asset.id;
                  const qtyStr = collateralAmounts[asset.id] || "";
                  const qty = parseFloat(qtyStr) || 0;
                  const maxPusdProvided = getAssetMaxPusd(asset.id, qtyStr);
                  const isSelected = qty > 0;
                  
                  return (
                    <div key={asset.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-colors ${isExpanded ? "border-black/20" : isSelected ? "border-black border-2" : "border-black/5"}`}>
                      <button 
                        onClick={() => toggleExpandPusdAsset(asset.id)}
                        className="w-full p-5 flex justify-between items-center text-left"
                      >
                        <div>
                          <div className="font-bold flex items-center space-x-2">
                            <span>{asset.symbol}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-black" />}
                          </div>
                          <div className="text-xs text-black/40 font-medium">Available: {balances[asset.tokenAddress].toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          {isSelected ? (
                            <>
                              <div className="text-xl font-bold text-black leading-tight tracking-tight">{qty} <span className="text-base font-bold text-black/40">{asset.symbol}</span></div>
                              <div className="text-[11px] text-green-600 font-bold uppercase tracking-widest mt-0.5">${maxPusdProvided.toFixed(2)} pUSD</div>
                            </>
                          ) : (
                            <div className="text-xs font-bold text-black/40 uppercase tracking-widest">Select</div>
                          )}
                        </div>
                      </button>

                      {isExpanded && (() => {
                        const ltv = getLtvForSymbol(asset.symbol);
                        const maxPusdFromBalance = balances[asset.tokenAddress] * asset.price * ltv;
                        const totalProvidedExcludingThis = totalProvidedPusd - maxPusdProvided;
                        const maxSliderPusd = Math.min(Math.max(0, desiredPusd - totalProvidedExcludingThis), maxPusdFromBalance);

                        return (
                          <div className="p-5 pt-0 bg-black/5 border-t border-black/5">
                            <div className="pt-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="w-full">
                                  <div className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Stock Amount</div>
                                  <div className="flex items-center">
                                    <input 
                                      type="number"
                                      value={qtyStr}
                                      onChange={(e) => setCollateralAmounts(prev => ({ ...prev, [asset.id]: e.target.value }))}
                                      placeholder="0.00"
                                      className="text-3xl font-bold bg-transparent outline-none w-full"
                                    />
                                    <span className="font-bold text-black/40 text-lg ml-2">{asset.symbol}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm space-y-3">
                                <div className="flex justify-between items-end">
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">pUSD Generated</div>
                                    <div className="text-2xl font-bold text-black">${maxPusdProvided.toFixed(2)}</div>
                                  </div>
                                  <div className="text-[10px] font-bold text-black/40 uppercase tracking-widest mb-1.5 text-right">
                                    Max limit<br/>${maxSliderPusd.toFixed(2)}
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={maxSliderPusd}
                                  step="0.01"
                                  value={maxPusdProvided}
                                  onChange={(e) => {
                                    const pUsdTarget = parseFloat(e.target.value) || 0;
                                    const newQty = pUsdTarget / ltv / asset.price;
                                    const rounded = Math.ceil(newQty * 1_000_000) / 1_000_000;
                                    setCollateralAmounts(prev => ({ ...prev, [asset.id]: rounded.toString() }));
                                  }}
                                  className="w-full accent-black cursor-pointer"
                                />
                              </div>
                              
                              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-black/40 pt-2 border-t border-black/5">
                                <span>Asset Value: ${(qty * asset.price).toFixed(2)}</span>
                                <span>LTV: {(ltv * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* BOX 1: Stock Deposit */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 block">You deposit (Collateral)</span>
              
              <div className="relative">
                <select 
                  value={selectedStockIdModeB || ""}
                  onChange={(e) => setSelectedStockIdModeB(e.target.value)}
                  className="w-full appearance-none bg-black/5 border-none rounded-2xl p-4 font-bold outline-none text-sm"
                >
                  {prestocks.filter(p => (balances[p.tokenAddress] || 0) > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.symbol} (Available: {balances[p.tokenAddress] || 0})</option>
                  ))}
                  {prestocks.filter(p => (balances[p.tokenAddress] || 0) > 0).length === 0 && (
                    <option disabled value="">No assets owned</option>
                  )}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none text-black/40" />
              </div>

              {selectedStockModeB && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="number"
                      value={stockQuantityStr}
                      onChange={(e) => {
                        setStockQuantityStr(e.target.value);
                        const q = parseFloat(e.target.value) || 0;
                        const max = q * selectedStockModeB.price * stockModeLtv;
                        setPusdToMintStr(Math.floor(max * 100) / 100 + "");
                      }}
                      placeholder="0"
                      className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-black/20"
                    />
                    <span className="font-bold text-black/40 text-lg ml-2">{selectedStockModeB.symbol}</span>
                  </div>
                  <div className="text-[11px] font-bold text-black/40 uppercase tracking-wider pt-2">
                    Value: ${(stockQuantity * selectedStockModeB.price).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* BOX 2: pUSD Mint */}
            <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-2 opacity-100 transition-opacity">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">You receive (pUSD)</span>
                {stockModeMaxPusd > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-600">Max limit: ${stockModeMaxPusd.toFixed(2)}</span>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center w-full">
                  <span className="text-3xl font-bold text-black/30 mr-1">$</span>
                  <input
                    type="number"
                    value={pusdToMintStr}
                    onChange={(e) => setPusdToMintStr(e.target.value)}
                    placeholder="0.00"
                    disabled={!selectedStockModeB || stockQuantity <= 0}
                    className="text-4xl font-bold bg-transparent border-none outline-none w-full placeholder:text-black/20 disabled:opacity-50"
                  />
                </div>
              </div>
              
              {pusdToMint > stockModeMaxPusd && stockModeMaxPusd > 0 && (
                <p className="text-xs text-red-600 font-bold pt-2">Exceeds maximum allowed pUSD limit!</p>
              )}
            </div>
          </>
        )}
      </main>

      <div className="p-6 bg-white border-t border-black/5 shrink-0">
        {mintMode === "PUSD" && desiredPusd > 0 && (
           <div className="flex justify-between items-center mb-4 px-2">
             <span className="text-xs font-bold text-black/60 uppercase tracking-widest">Collateral Limit</span>
             <span className={`text-sm font-bold ${totalProvidedPusd >= desiredPusd ? 'text-green-600' : 'text-red-600'}`}>
                ${totalProvidedPusd.toFixed(2)} / ${desiredPusd.toFixed(2)}
             </span>
           </div>
        )}

        {isProcessing ? (
          <div className="w-full py-4 bg-black/10 text-black font-bold rounded-2xl text-center flex flex-col items-center">
            {txStatus.split('\n').map((line, i) => <div key={i} className="text-sm">{line}</div>)}
          </div>
        ) : (
          <button 
            onClick={handleMint}
            disabled={mintMode === "PUSD" ? (!pusdModeValid || !authenticated) : (!stockModeValid || !authenticated)}
            className="w-full py-4 bg-black text-white font-bold rounded-2xl disabled:opacity-30 transition-opacity"
          >
            {mintMode === "PUSD" 
              ? (totalProvidedPusd >= desiredPusd && desiredPusd > 0 ? `Mint $${desiredPusd.toFixed(2)}` : "Add Collateral") 
              : pusdToMint > 0 && stockModeValid ? `Mint $${pusdToMint.toFixed(2)}` : "Enter Amount"}
          </button>
        )}
      </div>
    </div>
  );
}
