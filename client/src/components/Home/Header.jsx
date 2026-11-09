import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Heart, Menu, X } from "lucide-react"
import { Link } from "react-router-dom"
import WalletButton from "../WalletButton"

const navItems = [{ href: "/dashboard/campaigns", text: "Explore causes" }, { href: "#features", text: "How trust works" }, { href: "#live", text: "Impact" }]

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])
  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-colors ${isScrolled || isMenuOpen ? "border-neutral-200 bg-white text-neutral-900 shadow-sm" : "border-white/15 bg-neutral-950/25 text-white backdrop-blur-md"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-2 font-semibold" aria-label="ClearCause home"><span className="flex h-9 w-9 items-center justify-center bg-emerald-600 text-white"><Heart className="h-5 w-5" fill="currentColor" /></span><span className="text-xl">ClearCause</span></Link>
        <nav className="hidden items-center gap-7 md:flex">{navItems.map((item) => item.href.startsWith("/") ? <Link key={item.href} to={item.href} className="text-sm font-medium hover:text-emerald-500">{item.text}</Link> : <a key={item.href} href={item.href} className="text-sm font-medium hover:text-emerald-500">{item.text}</a>)}</nav>
        <div className="flex items-center gap-2"><div className="hidden sm:block"><WalletButton /></div><button type="button" className="flex h-10 w-10 items-center justify-center md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}>{isMenuOpen ? <X /> : <Menu />}</button></div>
      </div>
      <AnimatePresence>{isMenuOpen && <motion.nav initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-neutral-200 bg-white px-5 text-neutral-900 md:hidden"><div className="flex flex-col gap-1 py-4">{navItems.map((item) => item.href.startsWith("/") ? <Link key={item.href} to={item.href} className="py-3 font-medium" onClick={() => setIsMenuOpen(false)}>{item.text}</Link> : <a key={item.href} href={item.href} className="py-3 font-medium" onClick={() => setIsMenuOpen(false)}>{item.text}</a>)}<div className="pt-3 sm:hidden"><WalletButton /></div></div></motion.nav>}</AnimatePresence>
    </header>
  )
}

export default Header
