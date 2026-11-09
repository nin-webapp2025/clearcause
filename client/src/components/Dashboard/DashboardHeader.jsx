import { useLocation } from "react-router-dom"
import WalletButton from "../WalletButton"

const titles = { campaigns: "Causes", "create-campaign": "Start a campaign", governance: "Governance", kyc: "Verification", nfts: "Donation receipts", admin: "Campaign review" }

export function DashboardHeader() {
  const location = useLocation()
  const segment = location.pathname.split("/")[2]
  const title = titles[segment] || "Your impact"
  return <header className="flex min-h-20 items-center justify-between border-b border-neutral-200 bg-white px-4 pl-16 sm:px-6 md:pl-8"><div><p className="text-xs font-medium uppercase text-emerald-700">ClearCause</p><h1 className="text-lg font-semibold text-neutral-900">{title}</h1></div><WalletButton /></header>
}
