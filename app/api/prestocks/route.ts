import { NextResponse } from "next/server";

export type PreStock = {
  id: string;
  symbol: string;
  name: string;
  tokenAddress: string;
  price: number; // tokenPrice
  change24h: number;
  image: string;
  available: boolean;
  maxLTV: number;
  isDemoData?: boolean;
  
  // New fields
  tokenPrice: number;
  impliedValuation: number;
  markPrice: number;
  markValuation: number;
  premiumPercentage: number;
};

const FALLBACK_DATA: PreStock[] = [
  {
    id: "openai",
    symbol: "OPENAI",
    name: "OpenAI PreStocks",
    tokenAddress: process.env.NEXT_PUBLIC_TOKEN_OPENAI || "",
    price: 1099.34,
    change24h: 0,
    image: "https://www.prestocks.com/logos/openai.png",
    available: true,
    maxLTV: 75,
    isDemoData: true,
    tokenPrice: 1099.34,
    impliedValuation: 1362007106375,
    markPrice: 994.69,
    markValuation: 1232352348840,
    premiumPercentage: 10.5,
  },
  {
    id: "anthropic",
    symbol: "ANTHROPIC",
    name: "Anthropic PreStocks",
    tokenAddress: process.env.NEXT_PUBLIC_TOKEN_ANTHROPIC || "",
    price: 1037.39,
    change24h: 0,
    image: "https://www.prestocks.com/logos/anthropic.png",
    available: true,
    maxLTV: 75,
    isDemoData: true,
    tokenPrice: 1037.39,
    impliedValuation: 1699603204504,
    markPrice: 1045.60,
    markValuation: 1713055292460,
    premiumPercentage: -0.8,
  },
  {
    id: "anduril",
    symbol: "ANDURIL",
    name: "Anduril PreStocks",
    tokenAddress: process.env.NEXT_PUBLIC_TOKEN_ANDURIL || "",
    price: 156.51,
    change24h: 0,
    image: "https://www.prestocks.com/logos/anduril.png",
    available: true,
    maxLTV: 75,
    isDemoData: true,
    tokenPrice: 156.51,
    impliedValuation: 138466075701,
    markPrice: 154.72,
    markValuation: 136882792200,
    premiumPercentage: 1.1,
  },
  {
    id: "figureai",
    symbol: "FIGUREAI",
    name: "Figure AI PreStocks",
    tokenAddress: process.env.NEXT_PUBLIC_TOKEN_FIGUREAI || "",
    price: 181.77,
    change24h: 0,
    image: "https://www.prestocks.com/logos/figureai.png",
    available: true,
    maxLTV: 75,
    isDemoData: true,
    tokenPrice: 181.77,
    impliedValuation: 39631861132,
    markPrice: 181.16,
    markValuation: 39498328375,
    premiumPercentage: 0.3,
  },
];

export async function GET() {
  try {
    const response = await fetch("https://prestocks.com/api/prestocks", {
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    const prestocks: PreStock[] = (Array.isArray(data) ? data : data.data || []).map((item: Record<string, unknown>, index: number) => {
      const tokenPrice = typeof item.tokenPrice === "number" ? item.tokenPrice : parseFloat((item.tokenPrice as string) || (item.price as string) || "0");
      const markPrice = typeof item.markPrice === "number" ? item.markPrice : tokenPrice;
      const premiumPercentage = markPrice > 0 ? ((tokenPrice - markPrice) / markPrice) * 100 : 0;
      
      const symbol = (item.symbol as string) || "UNK";
      // Use our deployed devnet token if available, otherwise use live address
      const envTokenKey = `NEXT_PUBLIC_TOKEN_${symbol.toUpperCase()}`;
      const tokenAddress = process.env[envTokenKey] || (item.contract_address as string) || (item.tokenAddress as string) || (item.address as string) || "";
      
      return {
        id: (item.id as string) || symbol || `stock-${index}`,
        symbol: symbol,
        name: (item.name as string) || "Unknown Company",
        tokenAddress: tokenAddress,
        price: tokenPrice,
        change24h: typeof item.change24h === "number" ? item.change24h : parseFloat((item.change24h as string) || "0"),
        image: (item.image as string) || (item.logo as string) || "",
        available: item.available !== false,
        maxLTV: typeof item.maxLTV === "number" ? item.maxLTV : 75,
        isDemoData: false,
        tokenPrice,
        impliedValuation: typeof item.impliedValuation === "number" ? item.impliedValuation : parseFloat((item.impliedValuation as string) || "0"),
        markPrice,
        markValuation: typeof item.markValuation === "number" ? item.markValuation : parseFloat((item.markValuation as string) || "0"),
        premiumPercentage,
      };
    }).filter((stock: PreStock) => stock.symbol.toUpperCase() !== "SPACEX");

    if (prestocks.length === 0) {
      return NextResponse.json(FALLBACK_DATA);
    }

    return NextResponse.json(prestocks);
  } catch (error) {
    console.warn("Failed to fetch live PreStocks data, using fallback.", error);
    return NextResponse.json(FALLBACK_DATA);
  }
}
