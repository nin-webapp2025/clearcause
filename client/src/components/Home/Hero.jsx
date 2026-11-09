import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "../ui/button"
import heroImage from "../../assets/clearcause-hero.png"

const Hero = () => {
  const navigate = useNavigate()
  return (
    <section className="relative flex min-h-[88svh] items-end overflow-hidden bg-gradient-to-br from-emerald-950 to-neutral-900 pt-24 text-white">
      <img src={heroImage} alt="Community members collecting clean water from a new local water point" className="absolute inset-0 block h-full w-full object-cover object-center md:object-right" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,24,21,.94)_0%,rgba(17,24,21,.76)_42%,rgba(17,24,21,.2)_72%,rgba(17,24,21,.1)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/75 via-transparent to-neutral-950/20" />
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-10 pt-24 sm:px-8 md:pb-14 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 border border-white/25 bg-black/20 px-3 py-2 text-sm font-medium backdrop-blur-sm"><ShieldCheck className="h-4 w-4 text-emerald-300" />Verified causes. Public donation records.</div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] sm:text-6xl lg:text-7xl">Transparent charity donations.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/85 sm:text-xl">Support reviewed campaigns, receive an on-chain receipt, and follow every contribution from your wallet to the cause.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 bg-coral-500 px-6 text-white hover:bg-coral-600" onClick={() => navigate("/dashboard/campaigns")}>Explore causes <ArrowRight className="ml-2 h-5 w-5" /></Button>
            <Button size="lg" variant="outline" className="h-12 border-white/50 bg-white/10 px-6 text-white backdrop-blur-sm hover:bg-white hover:text-neutral-900" onClick={() => navigate("/dashboard/create-campaign")}>Start a campaign</Button>
          </div>
        </motion.div>
        <div className="mt-12 grid max-w-3xl grid-cols-1 border-y border-white/20 bg-black/15 backdrop-blur-sm sm:grid-cols-3">
          {[[CheckCircle2, "Reviewed", "before fundraising"], [HeartHandshake, "Traceable", "on-chain donations"], [ShieldCheck, "Protected", "refund safeguards"]].map(([Icon, title, detail]) => (
            <div key={title} className="flex items-center gap-3 border-white/20 px-4 py-4 sm:border-r sm:last:border-r-0"><Icon className="h-5 w-5 shrink-0 text-emerald-300" /><p className="text-sm"><span className="block font-semibold">{title}</span><span className="text-white/65">{detail}</span></p></div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Hero
