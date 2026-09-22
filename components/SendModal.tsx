/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";
import { useState } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

export default function SendModal({ 
  isOpen, 
  onClose, 
  address, 
  solanaWallet,
  prestocks,
  balances,
  solBalance
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  address: string | undefined,
  solanaWallet: any,
  prestocks: any[],
  balances: Record<string, number>,
  solBalance: number | null
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("SOL");
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!isOpen || !address) return null;

  // Filter available assets
  const PUSD_MINT = process.env.NEXT_PUBLIC_PUSD_MINT || "DCuZvy1gVz44zHKjLYCqmzNtWo5MbLyWyqxaVNy31475";
  const availableAssets = [
    { symbol: "SOL", address: "SOL", balance: solBalance || 0 },
    ...(balances[PUSD_MINT] > 0 ? [{ symbol: "pUSD", address: PUSD_MINT, balance: balances[PUSD_MINT] }] : []),
    ...prestocks.filter(p => balances[p.tokenAddress] > 0).map(p => ({
      symbol: p.symbol,
      address: p.tokenAddress,
      balance: balances[p.tokenAddress]
    }))
  ];

  const handleSend = async () => {
    if (!recipient || !amount || !solanaWallet) return;
    setIsSending(true);
    setTxHash(null);
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
      const conn = new Connection(rpcUrl, "confirmed");
      const fromPubkey = new PublicKey(address);
      const toPubkey = new PublicKey(recipient);
      const tx = new Transaction();

      if (selectedAsset === "SOL") {
        tx.add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
          })
        );
      } else {
        const mintPubkey = new PublicKey(selectedAsset);
        const fromAta = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
        const toAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
        
        const toAtaInfo = await conn.getAccountInfo(toAta);
        if (!toAtaInfo) {
          tx.add(createAssociatedTokenAccountInstruction(fromPubkey, toAta, toPubkey, mintPubkey));
        }

        // We assume 6 decimals for PreStocks
        tx.add(
          createTransferInstruction(
            fromAta,
            toAta,
            fromPubkey,
            Math.floor(parseFloat(amount) * 1_000_000)
          )
        );
      }

      const { blockhash } = await conn.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = fromPubkey;

      let signature;
      if (solanaWallet.sendTransaction) {
        const sendOptions = { uiOptions: { fundTx: false } };
        try {
          signature = await solanaWallet.sendTransaction(tx, conn, sendOptions);
        } catch(e) {
          signature = await solanaWallet.sendTransaction(tx, conn);
        }
        if (typeof signature === 'object' && signature !== null && 'signature' in signature) {
           signature = signature.signature;
        }
      } else if (solanaWallet.signAndSendTransaction) {
        const res = await solanaWallet.signAndSendTransaction(tx);
        signature = res.signature;
      } else {
        throw new Error("Wallet cannot send tx");
      }

      setTxHash(signature);
    } catch (err: any) {
      console.error(err);
      alert("Send failed: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const selectedAssetDetails = availableAssets.find(a => a.address === selectedAsset);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200">
          <X className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-black mb-6">Send Assets</h2>

        {txHash ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ArrowRight className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Transaction Sent!</h3>
            <a href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`} target="_blank" className="text-sm text-blue-500 hover:underline">
              View on Explorer
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Asset</label>
              <select 
                value={selectedAsset} 
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-black text-lg font-medium rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5"
              >
                {availableAssets.map(a => (
                  <option key={a.address} value={a.address}>{a.symbol} ({a.balance} available)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recipient Address</label>
              <input 
                type="text" 
                placeholder="Solana Address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-black font-mono text-sm rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Amount</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-black text-lg font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>

            <button 
              onClick={handleSend}
              disabled={isSending || !amount || !recipient || parseFloat(amount) > (selectedAssetDetails?.balance || 0)}
              className="w-full bg-black text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 disabled:opacity-50 mt-6"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Send</span>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
