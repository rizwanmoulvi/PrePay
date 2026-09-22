/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import Lithic from 'lithic';
import clientPromise from '@/lib/mongodb';

const lithic = new Lithic({
  apiKey: process.env.LITHIC_API_KEY || process.env.LITHIC_API || 'sandbox_key',
  environment: 'sandbox',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { walletAddress } = body;
    if (!walletAddress) {
      return NextResponse.json({ success: false, error: "walletAddress required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("prepay");
    const cardsCollection = db.collection("cards");

    // Check limit
    const count = await cardsCollection.countDocuments({ walletAddress });
    if (count >= 2) {
      return NextResponse.json({ success: false, error: "Maximum of 2 cards allowed per user" }, { status: 400 });
    }

    const card = await lithic.cards.create({
      type: 'VIRTUAL',
      state: 'OPEN',
      spend_limit: 100000,
    });

    // Save to mongo
    await cardsCollection.insertOne({
        walletAddress,
        cardToken: card.token,
        createdAt: new Date()
    });
    
    return NextResponse.json({ success: true, card });
  } catch (error: any) {
    console.error('Lithic create card error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json({ success: false, error: "Address required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("prepay");
    const userCards = await db.collection("cards").find({ walletAddress: address }).toArray();
    
    if (userCards.length === 0) {
        return NextResponse.json({ success: true, cards: [] });
    }

    const cardTokens = userCards.map(c => c.cardToken);
    
    // Fetch only these specific cards from Lithic to get the latest status
    const cards = [];
    for (const token of cardTokens) {
        try {
            const c = await lithic.cards.retrieve(token);
            cards.push(c);
        } catch (e) {
            console.error("Failed to retrieve card", token, e);
        }
    }

    return NextResponse.json({ success: true, cards });
  } catch (error: any) {
    console.error('Lithic list cards error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
