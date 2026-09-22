"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import type { PreStock } from "@/app/api/prestocks/route";

export default function Portfolio() {
  const { user } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const [prestocks, setPrestocks] = useState<PreStock[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const solanaWallet = solanaWallets[0];
  const walletAddress = solanaWallet?.address;
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<PreStock | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch PreStocks data
        const res = await fetch("/api/prestocks");
        let data: PreStock[] = [];
        if (res.ok) {
          data = await res.json();
          setPrestocks(data);
        }

        // Fetch balances if wallet is connected
        
        
        if (walletAddress) {
          const { Connection, PublicKey } = await import("@solana/web3.js");
          const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
          const connection = new Connection(rpcUrl, "confirmed");
          
          const accounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(walletAddress),
            { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
          );
          
          const newBalances: Record<string, number> = {};
          accounts.value.forEach((accountInfo) => {
            const parsedInfo = accountInfo.account.data.parsed.info;
            const mint = parsedInfo.mint;
            const amount = parsedInfo.tokenAmount.uiAmount;
            if (amount > 0) {
              newBalances[mint] = amount;
            }
          });
          setBalances(newBalances);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [walletAddress]);

  const filteredStocks = prestocks.filter((stock) => 
    stock.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen p-6 pb-24 max-w-md mx-auto w-full relative">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
      </header>

      <main className="flex-1 space-y-6">
        <div className="p-6 border border-black rounded-2xl space-y-4 bg-black text-white">
          <div className="flex justify-between items-center">
            <span className="font-medium text-white/60">My PreStocks</span>
            <span className="font-bold text-2xl">
              ${prestocks.reduce((acc, stock) => acc + (balances[stock.tokenAddress] || 0) * stock.price, 0).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
          <input
            type="text"
            placeholder="Search PreStocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 text-black placeholder:text-black/40"
          />
        </div>

        {/* List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Available to Deposit</h2>
          {loading ? (
            <div className="py-8 text-center text-black/60">Loading...</div>
          ) : filteredStocks.length === 0 ? (
            <div className="py-8 text-center text-black/60">No stocks found.</div>
          ) : (
            filteredStocks.map((stock) => (
              <div 
                key={stock.id} 
                onClick={() => setSelectedStock(stock)}
                className="flex items-center justify-between p-4 border border-black rounded-xl cursor-pointer hover:bg-black/5 transition-colors bg-white"
              >
                <div className="flex items-center space-x-4">
                  {stock.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={stock.image} alt={stock.symbol} className="w-10 h-10 rounded-full border border-black/10 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold text-xs">
                      {stock.symbol.substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold leading-tight">{stock.symbol}</h3>
                    <p className="text-xs text-black/60 truncate w-32">{stock.name}</p>
                    <p className="text-xs font-medium text-black mt-0.5">{balances[stock.tokenAddress] || 0} Tokens</p>
                    {stock.isDemoData && <span className="text-[10px] text-red-500 font-medium tracking-tighter uppercase">Demo</span>}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold">${((balances[stock.tokenAddress] || 0) * stock.price).toFixed(2)}</div>
                  <div className="text-xs font-medium text-black/60">
                    @ ${stock.price.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Bottom Sheet Modal */}
      {selectedStock && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm" 
            onClick={() => setSelectedStock(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black rounded-t-3xl z-50 p-6 space-y-6 max-h-[80vh] overflow-y-auto transform transition-transform pb-safe shadow-[0_-20px_40px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-4">
                {selectedStock.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={selectedStock.image} alt={selectedStock.symbol} className="w-12 h-12 rounded-full border border-black/10 object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-bold">
                    {selectedStock.symbol.substring(0, 2)}
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold leading-tight">{selectedStock.symbol}</h2>
                  <p className="text-sm text-black/60">{selectedStock.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStock(null)}
                className="p-2 bg-black/5 rounded-full hover:bg-black/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-end border-b border-black/10 pb-6">
              <div>
                <span className="text-sm text-black/60 font-medium uppercase tracking-wider block mb-1">Token Price</span>
                <span className="text-4xl font-bold tracking-tighter">${selectedStock.tokenPrice.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-black/60 font-medium uppercase tracking-wider block mb-1">Premium</span>
                <span className={`text-lg font-medium mb-1 ${selectedStock.premiumPercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {selectedStock.premiumPercentage >= 0 ? "+" : ""}{selectedStock.premiumPercentage.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Market Details</h3>
              <div className="flex justify-between items-center py-3 border-b border-black/10">
                <span className="text-black/60">Mark Price</span>
                <span className="font-medium">${selectedStock.markPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-black/10">
                <span className="text-black/60">Implied Valuation</span>
                <span className="font-medium">
                  ${selectedStock.impliedValuation > 1e9 
                    ? (selectedStock.impliedValuation / 1e9).toFixed(2) + "B" 
                    : selectedStock.impliedValuation > 1e6 
                    ? (selectedStock.impliedValuation / 1e6).toFixed(2) + "M"
                    : selectedStock.impliedValuation.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-black/10">
                <span className="text-black/60">Mark Valuation</span>
                <span className="font-medium">
                  ${selectedStock.markValuation > 1e9 
                    ? (selectedStock.markValuation / 1e9).toFixed(2) + "B" 
                    : selectedStock.markValuation > 1e6 
                    ? (selectedStock.markValuation / 1e6).toFixed(2) + "M"
                    : selectedStock.markValuation.toLocaleString()}
                </span>
              </div>

              <h3 className="font-semibold text-lg pt-2">Collateral Details</h3>
              <div className="flex justify-between items-center py-3 border-b border-black/10">
                <span className="text-black/60">Eligibility</span>
                <span className="font-medium text-green-600">Approved</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-black/10">
                <span className="text-black/60">Max LTV</span>
                <span className="font-medium">{selectedStock.maxLTV}%</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-black/10">
                <span className="text-black/60">Token Address</span>
                <span className="font-mono text-xs max-w-[150px] truncate">{selectedStock.tokenAddress}</span>
              </div>
            </div>

            <button className="w-full bg-black text-white py-4 rounded-xl font-medium text-lg hover:bg-black/80 transition-colors mt-4">
              Deposit {selectedStock.symbol}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
