import { Github, Heart } from "lucide-react"
import { Link } from "react-router-dom"

const Footer = () => <footer className="bg-white px-5 py-10 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-t border-neutral-200 pt-8 sm:flex-row sm:items-center"><Link to="/" className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center bg-emerald-600 text-white"><Heart className="h-4 w-4" fill="currentColor" /></span>ClearCause</Link><p className="text-sm text-neutral-500">Transparent giving, recorded on-chain.</p><a href="https://github.com/Kanasjnr/ClearCause" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-emerald-700"><Github className="h-4 w-4" />Project source</a></div></footer>

export default Footer
