import { Fingerprint, ReceiptText, RotateCcw, ScanSearch, ShieldCheck, WalletCards } from "lucide-react"

const features = [
  { icon: ShieldCheck, title: "Reviewed first", description: "A campaign cannot accept donations until an administrator approves it." },
  { icon: ReceiptText, title: "Public receipts", description: "Every donation creates a transaction hash you can independently verify." },
  { icon: ScanSearch, title: "Fraud signals", description: "Rule-based and anomaly checks flag suspicious activity for human review." },
  { icon: RotateCcw, title: "Refund safeguards", description: "Eligible donors can reclaim funds when a campaign is stopped or expires." },
  { icon: WalletCards, title: "Locked payout", description: "Funds can only be released to the wallet approved with the campaign." },
  { icon: Fingerprint, title: "Proof you keep", description: "Your wallet receives a durable NFT receipt for every contribution." },
]

const Features = () => (
  <section id="features" className="bg-white px-5 py-20 sm:px-8 lg:px-12">
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.6fr]">
        <div><p className="text-sm font-semibold text-coral-600">Built for accountable giving</p><h2 className="mt-3 text-3xl font-semibold leading-tight text-neutral-950 sm:text-4xl">Trust should be visible, not assumed.</h2><p className="mt-5 leading-7 text-neutral-600">ClearCause combines campaign review, fraud signals, and blockchain records so donors can inspect what happened to every gift.</p></div>
        <div className="grid border-l border-t border-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => <div key={title} className="border-b border-r border-neutral-200 p-6"><span className="mb-5 flex h-10 w-10 items-center justify-center bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></span><h3 className="font-semibold text-neutral-950">{title}</h3><p className="mt-2 text-sm leading-6 text-neutral-600">{description}</p></div>)}
        </div>
      </div>
    </div>
  </section>
)

export default Features
