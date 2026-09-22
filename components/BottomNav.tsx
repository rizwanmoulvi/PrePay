"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PieChart, Send, CircleDollarSign } from "lucide-react";

import { usePrivy } from "@privy-io/react-auth";

export function BottomNav() {
  const pathname = usePathname();
  const { authenticated, ready } = usePrivy();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Portfolio", href: "/portfolio", icon: PieChart },
    { label: "pUSD", href: "/pusd", icon: CircleDollarSign },
    { label: "Pay", href: "/pay", icon: Send },
  ];

  if (!ready || !authenticated) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-black pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? "text-black" : "text-black/40 hover:text-black/70"
              }`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
