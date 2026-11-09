import { useEffect, useState } from "react"
import { Contract, formatEther } from "ethers"
import { Coins, Receipt, Megaphone } from "lucide-react"
import { readOnlyProvider } from "../../constant/readOnlyProvider"
import { CAMPAIGN_STATUS, HIDDEN_FROM_PUBLIC } from "../../constant/campaignStatus"
import ClearCauseABI from "../../abis/ClearCause.json"

// Real numbers read from the contract, not marketing figures. If the chain cannot be
// reached (no deployment configured, or the local node is not running) the section says
// so plainly rather than showing invented totals.
const LiveStats = () => {
  const [stats, setStats] = useState(null)
  const [state, setState] = useState("loading") // loading | ready | unavailable

  useEffect(() => {
    let cancelled = false
    const address = import.meta.env.VITE_APP_CONTRACT_ADDRESS

    const load = async () => {
      if (!address) {
        if (!cancelled) setState("unavailable")
        return
      }
      try {
        const contract = new Contract(address, ClearCauseABI, readOnlyProvider)
        const campaigns = await contract.getAllCampaigns()
        const visible = campaigns.filter(
          (c) => !HIDDEN_FROM_PUBLIC.includes(CAMPAIGN_STATUS[Number(c.status)]),
        )
        const raised = visible.reduce((sum, c) => sum + c.amountCollected, 0n)
        const donations = visible.reduce((sum, c) => sum + c.donations.length, 0)
        if (!cancelled) {
          setStats({
            campaigns: visible.length,
            donations,
            raised: Number(formatEther(raised)),
          })
          setState("ready")
        }
      } catch {
        if (!cancelled) setState("unavailable")
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const items = stats
    ? [
        {
          icon: <Megaphone className="h-12 w-12 text-brand-600" />,
          value: stats.campaigns.toLocaleString(),
          label: stats.campaigns === 1 ? "Approved campaign" : "Approved campaigns",
        },
        {
          icon: <Receipt className="h-12 w-12 text-brand-600" />,
          value: stats.donations.toLocaleString(),
          label: "Donations recorded on-chain",
        },
        {
          icon: <Coins className="h-12 w-12 text-brand-600" />,
          value: `${stats.raised.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH`,
          label: "Raised across those campaigns",
        },
      ]
    : []

  return (
    <section id="live" className="bg-emerald-50 px-5 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10"><p className="text-sm font-semibold text-emerald-700">Live impact</p><h2 className="mt-3 text-3xl font-semibold text-neutral-950 sm:text-4xl">Read straight from the chain.</h2><p className="mt-3 max-w-2xl text-neutral-600">Current totals are calculated from the contract whenever this page loads.</p></div>

        {state === "ready" ? (
          <div className="grid grid-cols-1 border-l border-t border-emerald-200 md:grid-cols-3">
            {items.map((item, index) => (
              <div key={index} className="border-b border-r border-emerald-200 bg-white p-7">
                  {item.icon}
                  <h3 className="my-4 text-4xl font-semibold text-neutral-950">{item.value}</h3>
                  <p className="text-sm text-neutral-600">{item.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-600">
            {state === "loading"
              ? "Reading the contract…"
              : "The contract cannot be reached right now, so there are no figures to show."}
          </p>
        )}
      </div>
    </section>
  )
}

export default LiveStats
