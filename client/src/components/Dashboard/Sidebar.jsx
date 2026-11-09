import { useState } from "react"
import { Heart, Image, LayoutDashboard, Menu, Plus, Rocket, ShieldCheck, UserCheck, Vote, X } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import useIsAdmin from "../../hooks/Admin/useIsAdmin"
import { cn } from "../../lib/utils"

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/dashboard" },
  { icon: Rocket, label: "Explore causes", path: "/dashboard/campaigns" },
  { icon: Vote, label: "Governance", path: "/dashboard/governance" },
  { icon: UserCheck, label: "Verification", path: "/dashboard/kyc" },
  { icon: Image, label: "Donation receipts", path: "/dashboard/nfts" },
]

export function Sidebar() {
  const location = useLocation()
  const { isAdmin } = useIsAdmin()
  const [open, setOpen] = useState(false)
  const items = isAdmin ? [...menuItems, { icon: ShieldCheck, label: "Campaign review", path: "/dashboard/admin" }] : menuItems
  const active = (path) => path === "/dashboard" ? location.pathname === path : location.pathname.startsWith(path)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center border border-neutral-200 bg-white shadow-sm md:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
      {open && <button type="button" className="fixed inset-0 z-40 bg-black/35 md:hidden" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-neutral-200 bg-white transition-transform md:static md:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-20 items-center justify-between border-b border-neutral-100 px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold"><span className="flex h-9 w-9 items-center justify-center bg-emerald-600 text-white"><Heart className="h-5 w-5" fill="currentColor" /></span>ClearCause</Link>
          <button type="button" onClick={() => setOpen(false)} className="md:hidden" aria-label="Close navigation"><X /></button>
        </div>
        <div className="px-4 pt-5"><Link to="/dashboard/create-campaign" onClick={() => setOpen(false)} className="flex h-11 items-center justify-center gap-2 bg-coral-500 px-4 text-sm font-semibold text-white hover:bg-coral-600"><Plus className="h-4 w-4" />Start a campaign</Link></div>
        <nav className="flex-1 px-3 py-5"><p className="px-3 pb-2 text-xs font-semibold uppercase text-neutral-400">Workspace</p><ul className="space-y-1">{items.map((item) => <li key={item.path}><Link to={item.path} onClick={() => setOpen(false)} className={cn("flex h-11 items-center gap-3 px-3 text-sm font-medium transition-colors", active(item.path) ? "bg-emerald-50 text-emerald-800" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950")}><item.icon className="h-5 w-5" />{item.label}</Link></li>)}</ul></nav>
        <div className="border-t border-neutral-100 p-5 text-xs leading-5 text-neutral-500"><ShieldCheck className="mb-2 h-5 w-5 text-emerald-600" />Campaigns are reviewed before they can receive donations.</div>
      </aside>
    </>
  )
}
