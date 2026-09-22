"use client";
import QRCode from "react-qr-code";
import { Copy, X } from "lucide-react";

export default function ReceiveModal({ isOpen, onClose, address }: { isOpen: boolean, onClose: () => void, address: string | undefined }) {
  if (!isOpen || !address) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200">
          <X className="w-5 h-5 text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-black mb-6">Receive Assets</h2>
        
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6">
          <QRCode value={address} size={200} />
        </div>
        
        <div className="w-full bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100">
          <span className="font-mono text-sm text-gray-600 truncate mr-3">{address}</span>
          <button 
            onClick={() => navigator.clipboard.writeText(address)}
            className="flex-shrink-0 bg-black text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-xs text-gray-400 mt-4 text-center">
          Send only Solana (SOL) and SPL tokens (PreStocks) to this address.
        </p>
      </div>
    </div>
  );
}
