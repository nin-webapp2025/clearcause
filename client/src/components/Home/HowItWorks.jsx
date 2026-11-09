import { ArrowRight, CircleDollarSign, SearchCheck, Wallet } from "lucide-react"

const steps = [
  { number: "01", icon: SearchCheck, title: "Choose a reviewed cause", description: "Compare the goal, deadline, creator, funding progress, and campaign status." },
  { number: "02", icon: Wallet, title: "Connect your wallet", description: "Confirm the amount and approve the donation directly from your own wallet." },
  { number: "03", icon: CircleDollarSign, title: "Track your impact", description: "Use the transaction hash and receipt to follow the gift on the blockchain." },
]

const HowItWorks = () => (
  <section id="how-it-works" className="bg-neutral-950 px-5 py-20 text-white sm:px-8 lg:px-12">
    <div className="mx-auto max-w-7xl"><div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-emerald-300">A clearer way to give</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">From cause to confirmed receipt.</h2></div><p className="max-w-md text-sm leading-6 text-neutral-400">No hidden ledger and no manual receipt. The record is created by the donation transaction itself.</p></div>
      <div className="grid border-l border-t border-white/15 md:grid-cols-3">{steps.map(({ number, icon: Icon, title, description }, index) => <div key={title} className="relative border-b border-r border-white/15 p-7"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-neutral-500">{number}</span><Icon className="h-6 w-6 text-emerald-300" /></div><h3 className="mt-12 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-neutral-400">{description}</p>{index < 2 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 bg-neutral-950 text-coral-500 md:block" />}</div>)}</div>
    </div>
  </section>
)

export default HowItWorks
