/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Loader2, QrCode, ScanLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function Pay() {
  const router = useRouter();
  const { user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const solanaWallet = solanaWallets[0];
  let walletAddress = solanaWallet?.address || user?.wallet?.address;
  if (walletAddress?.startsWith("0x")) walletAddress = undefined;
  
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) fetchCards();
  }, [walletAddress]);

  useEffect(() => {
    if (scanning) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      scanner.render(
        (text) => {
          setScanResult(text);
          setScanning(false);
          scanner.clear();
        },
        (err) => { /* ignore */ }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [scanning]);

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/lithic/card?address=${walletAddress}`);
      const data = await res.json();
      if (data.success && data.cards) {
        setCards(data.cards);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCard = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/lithic/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress }) });
      const data = await res.json();
      if (data.success && data.card) {
        setCards([data.card, ...cards]);
      } else {
        alert("Failed to create card: " + data.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F9F9F9] max-w-md mx-auto w-full relative">
      <header className="flex items-center justify-between p-6 bg-white border-b border-black/5 shrink-0 z-10">
        <div className="flex items-center">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold ml-2">Cards & Pay</h1>
        </div>
        <button onClick={() => setScanning(true)} className="p-2 bg-black text-white rounded-full hover:bg-black/80 transition-colors">
          <ScanLine className="w-5 h-5" />
        </button>
      </header>

      {/* QR Scanner Modal */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="p-6 flex justify-between items-center text-white">
            <h2 className="text-xl font-bold">Scan QR Code</h2>
            <button onClick={() => setScanning(false)} className="p-2 bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div id="reader" className="w-full max-w-sm overflow-hidden rounded-3xl bg-white"></div>
            <p className="mt-8 text-white/60 text-center text-sm">Point your camera at a payment QR code.</p>
          </div>
        </div>
      )}

      {/* QR Scan Result */}
      {scanResult && !scanning && (
        <div className="p-6 m-6 bg-green-50 border border-green-200 rounded-3xl shadow-sm relative">
          <button onClick={() => setScanResult(null)} className="absolute top-4 right-4 text-black/40 hover:text-black">
             <X className="w-5 h-5" />
          </button>
          <h3 className="font-bold text-green-800 mb-1">Scanned Successfully!</h3>
          <p className="text-xs text-green-700 break-all bg-white/50 p-2 rounded mt-2 font-mono">
            {scanResult}
          </p>
          <button className="w-full mt-4 py-3 bg-black text-white rounded-xl font-bold text-sm">
            Proceed to Payment
          </button>
        </div>
      )}

      <main className="flex-1 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold tracking-tight">Your Virtual Cards</h2>
          <button 
            onClick={handleCreateCard}
            disabled={creating || cards.length >= 2}
            className="flex items-center space-x-1 bg-black text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-black/80 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{cards.length >= 2 ? "Limit Reached" : "New Card"}</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center p-12 text-black/40 text-sm">Loading cards...</div>
        ) : cards.length === 0 ? (
          <div className="bg-white border border-black/10 rounded-3xl p-8 flex flex-col items-center text-center space-y-3 shadow-sm">
            <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-2">
              <QrCode className="w-8 h-8 text-black/40" />
            </div>
            <span className="font-bold text-lg">No Cards Found</span>
            <p className="text-sm text-black/50">Create a virtual Lithic debit card to spend your pUSD anywhere.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {cards.map((card, i) => (
              <div key={i} className="relative rounded-3xl p-6 text-white shadow-lg overflow-hidden w-full aspect-[1.586/1] flex flex-col justify-between group">
                {/* Background Art */}
                <img 
                  src="/visa-card-art.png" 
                  alt="Visa Card Background" 
                  className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/15 z-0"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 z-0"></div>
                
                {/* Content */}
                <div className="relative z-10 flex justify-between items-start">
                  <div className="flex flex-col">
                     <span className="font-extrabold tracking-widest text-lg drop-shadow-md">PrePay</span>
                     <span className="text-[10px] font-medium tracking-widest opacity-80 uppercase mt-0.5 drop-shadow">Lithic Virtual</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 bg-white/20 backdrop-blur-md rounded border border-white/20 text-white tracking-widest shadow-sm">
                    {card.state}
                  </span>
                </div>
                
                <div className="relative z-10 flex flex-col">
                  <span className="text-lg sm:text-xl font-mono tracking-[0.15em] sm:tracking-[0.2em] mb-2 drop-shadow-md whitespace-nowrap">
                    •••• •••• •••• {card.last_four || "XXXX"}
                  </span>
                  <div className="flex space-x-6 text-xs font-mono font-semibold opacity-90 uppercase tracking-widest drop-shadow">
                    <div className="flex flex-col">
                       <span className="text-[8px] opacity-70 mb-0.5">VALID THRU</span>
                       <span>{card.exp_month || "MM"}/{card.exp_year ? card.exp_year.toString().slice(-2) : "YY"}</span>
                    </div>
                    <div className="flex flex-col">
                       <span className="text-[8px] opacity-70 mb-0.5">CVV</span>
                       <span>{card.cvv || "•••"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
