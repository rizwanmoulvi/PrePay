# PrePay 

**Deposit PreStocks. Mint pUSD. Spend globally.**

PrePay is a next-generation decentralized finance (DeFi) application built on Solana. It bridges the gap between illiquid pre-IPO equities and everyday spending power. Users can deposit tokenized pre-IPO stocks (PreStocks) as collateral to mint **pUSD** (PrePay USD), which can then be instantly spent in the real world using provisioned **Virtual Visa Debit Cards**.

---

##  Features

- **Multi-Asset Collateralization:** Deposit up to 7 distinct tokenized PreStocks (including OpenAI, Anthropic, Anduril, Neuralink, and more) into Anchor-based smart contracts.
- **Auto-Allocate Minting Engine:** Dynamically calculates your maximum Loan-to-Value (LTV) ratios across multiple assets and batches Solana transactions (via smart chunking) to seamlessly mint pUSD without hitting transaction size limits.
- **Batched Redemption:** Effortlessly manage active positions. Repay your pUSD debt and withdraw your underlying PreStock collateral in a single click.
- **Lithic Virtual Cards:** Direct integration with the **Lithic API**. Generate up to 2 virtual Visa debit cards tied securely to your Solana wallet, allowing you to spend your pUSD anywhere Visa is accepted.
- **Scan to Pay:** Built-in HTML5 QR code scanner for seamless, instant mobile payments directly from your digital wallet.
- **Resilient RPC Infrastructure:** A custom-built backend indexer caches your active Anchor positions and precise transaction history (`preTokenBalances` vs `postTokenBalances`) in MongoDB. This guarantees lightning-fast UI loads and completely eliminates Devnet `429 Too Many Requests` rate limits.
- **Embedded Web3 Wallets:** Powered by **Privy**, offering a frictionless onboarding experience via Email and Social logins with cross-chain embedded wallets.

---

## Tech Stack

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), React, Tailwind CSS
- **Web3 & Smart Contracts:** [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/), [Anchor Framework](https://www.anchor-lang.com/)
- **Authentication:** [Privy](https://privy.io/)
- **Fiat Issuance:** [Lithic API](https://lithic.com/)
- **Database / Caching:** MongoDB
- **UI Icons:** Lucide React

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- A MongoDB cluster (Atlas or local)
- A Lithic Sandbox API Key
- A Privy App ID

### Environment Setup

Create a `.env.local` file in the root directory and populate it with the following keys:

```env
# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PUSD_MINT=your_pusd_mint_address

# MongoDB Caching
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/prepay?retryWrites=true&w=majority

# Lithic Integration
LITHIC_API=your_lithic_sandbox_api_key
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/prepay.git
   cd prepay
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

---

## Project Structure

- `/app`: Next.js 15 App Router pages (Home, Mint, Redeem, pUSD Hub, Pay).
- `/app/api`: Backend routes powering the Lithic integration, PreStock oracle fetching, and the resilient MongoDB history/positions indexer.
- `/components`: Reusable UI components (SendModal, ReceiveModal, LoginButton).
- `/lib`: Core utilities, including the Anchor IDL definitions, MongoDB client, and transaction instruction builders.
- `/public`: Static assets, including the custom `visa-card-art.png` used for the digital wallet UI.
- `/scripts`: Utility scripts for deploying test tokens and funding test wallets on Devnet.

---

## License

This project is licensed under the MIT License.
