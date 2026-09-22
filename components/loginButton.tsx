"use client";

import { useLogin } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

export default function LoginButton() {
  const router = useRouter();
  const { login } = useLogin({
    onComplete: (user) => {
      if (user.user) {
        router.replace("/");
      }
    },
  });

  return (
    <button
      onClick={login}
      className="w-full bg-black text-white py-4 rounded-xl font-medium hover:bg-gray-900 transition-colors flex items-center justify-center"
      type="button"
    >
      Connect Wallet
    </button>
  );
}
