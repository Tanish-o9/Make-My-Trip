"use client";

import { useRouter } from "next/navigation";
import { Scene3D } from "@/components/Scene3D";
import { HomepageScene } from "@/scenes/HomepageScene";
import { Button, Card, Badge } from "@/components/ui";
import { usePerformance } from "@/context/PerformanceGuard";
import { ArrowRight, Compass, Award } from "lucide-react";

import { useEffect } from "react";
import { logFunnel } from "@/lib/telemetry";

export default function Home() {
  const router = useRouter();
  const { use3D } = usePerformance();

  useEffect(() => {
    logFunnel("homepage");
  }, []);

  // 2D Static SVG fallback illustration of the route ribbon curve
  const staticFallbackIllustration = (
    <div className="relative w-full h-64 md:h-80 bg-slate-900/40 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
      <svg className="absolute inset-0 w-full h-full text-slate-800/20" viewBox="0 0 800 300" fill="none">
        <path
          d="M -50 150 C 200 50, 250 250, 400 150 C 550 50, 600 250, 850 150"
          stroke="url(#fallback-gradient)"
          strokeWidth="6"
          strokeDasharray="12 6"
        />
        <defs>
          <linearGradient id="fallback-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0FA3A0" />
            <stop offset="100%" stopColor="#FF9F1C" />
          </linearGradient>
        </defs>
      </svg>
      {/* Waypoint Markers on Fallback */}
      <div className="absolute flex gap-8 items-center z-10">
        {["Manali", "Goa", "Jaipur", "Kerala", "Delhi"].map((city, idx) => (
          <div key={city} className="flex flex-col items-center">
            <div
              className={`rounded-full transition-all ${
                city === "Delhi"
                  ? "w-4.5 h-4.5 bg-marigold shadow-[0_0_10px_#FF9F1C] animate-pulse"
                  : "w-3.5 h-3.5 bg-teal opacity-80"
              }`}
            />
            <span className="text-[9px] font-bold text-muted mt-1 font-display uppercase">
              {city}
            </span>
          </div>
        ))}
      </div>
      <span className="absolute bottom-4 right-4 text-[9px] font-data text-muted uppercase">
        2D Illustration Mode
      </span>
    </div>
  );

  const schemaOrgData = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "name": "Ghumne Chale",
    "url": "http://localhost:3001",
    "logo": "http://localhost:3001/next.svg",
    "description": "Premium Flight & Hotel AI Trip Planner with 3D Ledger Pathways.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "New Delhi",
      "addressCountry": "IN"
    }
  };

  return (
    <div className="min-h-screen bg-base text-primary font-body pb-12 flex flex-col justify-between">
      {/* SEO & Meta Elements */}
      <title>Ghumne Chale - Premium Flight & Hotel AI Trip Planner</title>
      <meta name="description" content="AI-First Travel Planner with stunning 3D cosmic route ribbons. Book premium stays and flights instantly." />
      <meta property="og:title" content="Ghumne Chale - Premium AI Trip Planner" />
      <meta property="og:description" content="AI-First Travel Planner with stunning 3D cosmic route ribbons." />
      <meta property="og:type" content="website" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgData) }}
      />

      {/* Top Navbar */}
      <nav className="border-b border-slate-900 bg-base/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display font-extrabold text-base tracking-wider text-primary uppercase flex items-center gap-2">
              ✈️ GHUMNE CHALE
            </span>
            <div className="hidden md:flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
              <span className="text-primary border-b-2 border-marigold pb-1 px-1">
                Explore
              </span>
              <a
                href="/dashboard"
                className="text-muted hover:text-primary transition-colors"
              >
                My Trips
              </a>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/components-preview")}
              className="text-xs font-bold border-slate-800"
            >
              UI Sandbox
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Hero Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-8 flex-1 w-full">
        {/* Banner badge and main Space Grotesk headline */}
        <div className="space-y-3 text-left">
          <Badge variant="info">WEEKEND TRIPS • LOCAL OUTINGS • ADVENTURES</Badge>
          <h1 className="font-display font-extrabold text-4xl md:text-5xl lg:text-6xl text-primary uppercase tracking-tight max-w-3xl leading-[1.1]">
            Ghumo, ruko, phir aage badho
          </h1>
          <p className="text-xs md:text-sm text-muted font-semibold max-w-xl leading-relaxed">
            Discover, unwind, and journey forward. Map out your next premium travel itinerary with our AI-powered cosmic route-planner.
          </p>
        </div>

        {/* 3D Scene View / Fallback Ribbon */}
        <div className="relative w-full rounded-lg overflow-hidden border border-slate-900">
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <span className="text-[10px] font-display font-black text-teal uppercase tracking-widest block">
              SYSTEM HEROPATH
            </span>
            <span className="text-xs font-bold text-primary block mt-0.5">
              3D Dynamic Waypoint Ribbon
            </span>
          </div>

          <Scene3D
            id="homepage-ribbon"
            sceneContent={<HomepageScene />}
            fallback={staticFallbackIllustration}
          />
          
          {/* Sizing box for layout spacing while R3F renders behind */}
          {use3D && <div className="w-full h-64 md:h-80 pointer-events-none" />}
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4 justify-start pt-2">
          <Button
            variant="primary-marigold"
            onClick={() => window.location.href = "http://localhost:3000/"}
            className="flex items-center gap-2"
          >
            Plan a trip <ArrowRight size={14} />
          </Button>
          <Button
            variant="secondary-teal"
            onClick={() => router.push("/dashboard")}
            className="border-base"
          >
            My bookings
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
          <Card variant="default" className="flex flex-col justify-between">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
              Total Journeys
            </span>
            <span className="font-display font-extrabold text-3xl text-primary mt-2">
              2,400+
            </span>
            <span className="text-[9px] text-muted font-semibold mt-1 block">
              Trips completed globally
            </span>
          </Card>
          <Card variant="default" className="flex flex-col justify-between">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
              Waypoints Indexed
            </span>
            <span className="font-display font-extrabold text-3xl text-teal mt-2">
              180+
            </span>
            <span className="text-[9px] text-muted font-semibold mt-1 block">
              Unique vacation spots catalogued
            </span>
          </Card>
          <Card variant="default" className="flex flex-col justify-between">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
              Customer Satisfaction
            </span>
            <span className="font-display font-extrabold text-3xl text-marigold mt-2">
              4.8 ★
            </span>
            <span className="text-[9px] text-muted font-semibold mt-1 block">
              Average traveler terminal rating
            </span>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 mt-12 pt-6 text-center text-[10px] font-semibold text-muted font-data uppercase tracking-wider max-w-7xl mx-auto px-8 w-full">
        Ghumne Chale © 2026. Made with Google Antigravity.
      </footer>
    </div>
  );
}
