import { ArrowRight, HeartHandshake } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "../ui/button"

const CTA = () => {
  const navigate = useNavigate()
  return <section className="bg-coral-500 px-5 py-16 text-white sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center"><div className="flex gap-5"><HeartHandshake className="hidden h-10 w-10 shrink-0 sm:block" /><div><h2 className="text-3xl font-semibold">Make your next gift traceable.</h2><p className="mt-2 max-w-xl text-white/80">Browse approved campaigns and choose the cause you want to move forward.</p></div></div><Button size="lg" className="h-12 shrink-0 bg-white text-neutral-950 hover:bg-neutral-100" onClick={() => navigate("/dashboard/campaigns")}>Explore causes <ArrowRight className="ml-2 h-5 w-5" /></Button></div></section>
}

export default CTA
