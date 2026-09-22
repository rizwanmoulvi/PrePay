/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { Connection } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { IDL } from '@/lib/prepay/idl';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db("prepay");

    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const conn = new Connection(rpcUrl, "confirmed");
    const dummyProvider = new AnchorProvider(conn, {} as any, { commitment: "confirmed" });
    const program = new Program(IDL as any, dummyProvider);
    
    try {
        const allPositions = await (program.account as any).userPosition.all([
          { memcmp: { offset: 8, bytes: address } }
        ]);
        
        const positionsToSave = allPositions.map((p: any) => ({
            pubkey: p.publicKey.toBase58(),
            owner: p.account.owner.toBase58(),
            collateralMint: p.account.collateralMint.toBase58(),
            collateralAmount: p.account.collateralAmount.toNumber(),
            debt: p.account.debt.toNumber(),
        })).filter((p: any) => p.collateralAmount > 0);

        await db.collection("positions").deleteMany({ owner: address });
        if (positionsToSave.length > 0) {
            await db.collection("positions").insertMany(positionsToSave);
        }
        
        return NextResponse.json({ success: true, positions: positionsToSave });
    } catch (e) {
        console.error("RPC fetch failed, falling back to MongoDB:", e);
        const cachedPositions = await db.collection("positions").find({ owner: address }).toArray();
        return NextResponse.json({ success: true, positions: cachedPositions });
    }
  } catch (err: any) {
    console.error("Positions API Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
