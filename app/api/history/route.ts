/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Connection, PublicKey } from '@solana/web3.js';
import { PROGRAM_ID, PUSD_MINT } from '@/lib/prepay/program';

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const conn = new Connection(rpcUrl, "confirmed");

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("prepay");
    
    // Fire and forget sync (so we don't block the UI!)
    syncHistory(address, db).catch(console.error);

    // Immediately return the DB cached history!
    const history = await db.collection("history").find({ userAddress: address }).sort({ blockTime: -1 }).toArray();
    return NextResponse.json({ success: true, history });

  } catch (err: any) {
    console.error("History DB error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function syncHistory(address: string, db: any) {
    const userPubkey = new PublicKey(address);
    // Fetch last 10 signatures
    const sigs = await conn.getSignaturesForAddress(userPubkey, { limit: 10 });
    
    // Check if these signatures already exist in DB to prevent unnecessary fetching!
    const sigStrings = sigs.map(s => s.signature);
    const existing = await db.collection("history").find({ signature: { $in: sigStrings } }).project({ signature: 1 }).toArray();
    const existingSet = new Set(existing.map((e: any) => e.signature));
    
    const missingSigs = sigs.filter(s => !existingSet.has(s.signature));
    if (missingSigs.length === 0) return; // Nothing to sync

    // Process missing ones one by one with a delay to completely avoid 429
    for (let i = 0; i < missingSigs.length; i++) {
        const s = missingSigs[i];
        try {
            const tx = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
            if (!tx || tx.meta?.err) continue;
            
            const isPrepay = tx.transaction.message.accountKeys.some((k) => k.pubkey.toBase58() === PROGRAM_ID.toBase58());
            if (!isPrepay) continue;

            const preBalances = tx.meta?.preTokenBalances || [];
            const postBalances = tx.meta?.postTokenBalances || [];
            
            let pusdDelta = 0;
            const assetDeltas: Record<string, number> = {};
            
            const allMints = new Set<string>();
            preBalances.forEach(b => { if(b.owner === address) allMints.add(b.mint) });
            postBalances.forEach(b => { if(b.owner === address) allMints.add(b.mint) });
            
            allMints.forEach(mint => {
                const pre = preBalances.find(b => b.mint === mint && b.owner === address)?.uiTokenAmount.uiAmount || 0;
                const post = postBalances.find(b => b.mint === mint && b.owner === address)?.uiTokenAmount.uiAmount || 0;
                const delta = post - pre;
                
                if (Math.abs(delta) < 0.0001) return; 
                if (mint === PUSD_MINT.toBase58()) pusdDelta += delta;
                else assetDeltas[mint] = (assetDeltas[mint] || 0) + delta;
            });

            if (pusdDelta === 0 && Object.keys(assetDeltas).length === 0) continue;

            let action = "Transaction";
            if (pusdDelta > 0) action = "Mint pUSD";
            else if (pusdDelta < 0) action = "Burn pUSD";
            else if (Object.values(assetDeltas).some(d => d > 0)) action = "Withdraw Collateral";
            else if (Object.values(assetDeltas).some(d => d < 0)) action = "Deposit Collateral";

            const blockTime = tx.blockTime || Math.floor(Date.now() / 1000);
            
            await db.collection("history").updateOne(
                { signature: s.signature },
                { $set: { userAddress: address, signature: s.signature, blockTime, action, pusdDelta, assetDeltas } },
                { upsert: true }
            );

            // Add an explicit delay for RPC 429
            await new Promise(r => setTimeout(r, 800));
        } catch (e) {
            console.error("Failed to parse tx during sync:", e);
        }
    }
}
