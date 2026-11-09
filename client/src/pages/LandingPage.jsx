import React from 'react'
import Header from "../components/Home/Header"
import Hero from "../components/Home/Hero"
import Features from "../components/Home/Features"
import HowItWorks from "../components/Home/HowItWorks"
import LiveStats from "../components/Home/LiveStats"

import CTA from "../components/Home/CTA"
import Footer from "../components/Home/Footer"
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <LiveStats />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}

export default LandingPage
