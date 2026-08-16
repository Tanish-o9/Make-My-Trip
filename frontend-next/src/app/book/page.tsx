"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Scene3D } from "@/components/Scene3D";
import { BookingRibbonScene } from "@/scenes/BookingRibbonScene";
import { Button, Card, Badge, Input, Select, StepIndicator } from "@/components/ui";
import { usePerformance } from "@/context/PerformanceGuard";
import { ArrowRight, ArrowLeft, Shield, Briefcase, Info } from "lucide-react";

import { logFunnel } from "@/lib/telemetry";

export default function BookPage() {
  const router = useRouter();
  const { use3D } = usePerformance();

  // Multi-step state: 0 = Details, 1 = Add-ons, 2 = Review
  const [step, setStep] = useState(0);

  // Form inputs state (Details)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Add-ons selected state
  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasLuggage, setHasLuggage] = useState(false);

  // Load from sessionStorage if exists to preserve data across refreshes
  useEffect(() => {
    logFunnel("booking_start");
    const saved = sessionStorage.getItem("booking_details");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setName(parsed.name || "");
        setPhone(parsed.phone || "");
        setEmail(parsed.email || "");
        setIdType(parsed.idType || "passport");
        setIdNumber(parsed.idNumber || "");
        setHasInsurance(!!parsed.hasInsurance);
        setHasLuggage(!!parsed.hasLuggage);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Save state helper
  const saveState = (updatedStep?: number) => {
    const stateObj = { name, phone, email, idType, idNumber, hasInsurance, hasLuggage };
    sessionStorage.setItem("booking_details", JSON.stringify(stateObj));
    if (updatedStep !== undefined) {
      setStep(updatedStep);
    }
  };

  // Step 1 Validation & Next
  const handleDetailsNext = () => {
    const errs: Record<string, string> = {};
    if (!name) errs.name = "Full name is required";
    if (!phone) errs.phone = "Phone number is required";
    if (!email) errs.email = "Email is required";
    if (!idNumber) errs.idNumber = "ID number is required";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    saveState(1);
  };

  // Step 2 Next
  const handleAddonsNext = () => {
    saveState(2);
  };

  // Step 3 Next (proceed to payment Phase 6)
  const handleReviewConfirm = () => {
    saveState();
    router.push("/payment");
  };

  // 2D Static progress ribbon fallback
  const staticProgressFallback = (
    <div className="w-full h-12 bg-slate-900/30 rounded border border-slate-800 flex items-center justify-center relative overflow-hidden">
      <div className="w-2/3 h-1 bg-slate-800 rounded-full relative">
        <div
          className="h-full bg-teal transition-all duration-300"
          style={{ width: `${(step + 1) * 25}%` }}
        />
      </div>
      <span className="absolute bottom-1 right-2 text-[7px] font-data text-muted uppercase">
        2D Ribbon Line
      </span>
    </div>
  );

  const stepsLabel = ["Traveler Info", "Select Add-ons", "Verify details", "Payment Check"];

  // Pricing calculations
  const baseFare = 6200;
  const insurancePrice = 450;
  const luggagePrice = 750;
  const taxPrice = 1116;
  const totalPrice = baseFare + (hasInsurance ? insurancePrice : 0) + (hasLuggage ? luggagePrice : 0) + taxPrice;

  return (
    <div className="min-h-screen bg-base text-primary font-body pb-12">
      <title>Book Flights & Hotels | Ghumne Chale</title>
      <meta name="robots" content="noindex,nofollow" />
      {/* Top Navbar */}
      <nav className="border-b border-slate-900 bg-base/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display font-extrabold text-base tracking-wider text-primary uppercase flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
              ✈️ GHUMNE CHALE
            </span>
            <div className="hidden md:flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
              <span className="text-muted">Explore</span>
              <a href="/dashboard" className="text-muted hover:text-primary transition-colors">
                My Trips
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 mt-8 space-y-6">
        
        {/* Step Indicator Header with Step-Ribbon */}
        <div className="space-y-2 text-center">
          <h1 className="font-display font-extrabold text-2xl text-primary uppercase tracking-tight">
            Checkout Terminal
          </h1>
          <p className="text-xs text-muted font-semibold">
            Input passenger details and configure options.
          </p>
        </div>

        {/* 3D step-ribbon decorator */}
        <div className="relative w-full rounded-lg overflow-hidden border border-slate-900 h-24 bg-slate-900/10">
          <Scene3D
            id="booking-ribbon"
            sceneContent={<BookingRibbonScene currentStep={step} />}
            fallback={staticProgressFallback}
          />
          {use3D && <div className="w-full h-full pointer-events-none" />}
        </div>

        {/* Standard step indicator */}
        <StepIndicator currentStep={step} steps={stepsLabel} />

        {/* STEP 1: Traveler Details */}
        {step === 0 && (
          <Card variant="default" className="space-y-6 text-left">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-sm uppercase text-teal">
                Step 1: Traveler Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Full Name"
                placeholder="As per official documents"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={errors.name}
                className="focus:border-teal/80"
              />
              <Input
                label="Phone Number"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={errors.phone}
                className="focus:border-teal/80"
              />
              <Input
                label="Email ID"
                placeholder="traveler@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                className="focus:border-teal/80"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Select
                    label="ID Type"
                    value={idType}
                    onChange={(e) => setIdType(e.target.value)}
                    options={[
                      { value: "passport", label: "Passport" },
                      { value: "aadhaar", label: "Aadhaar" },
                      { value: "pan", label: "PAN" },
                    ]}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    label="ID Number"
                    placeholder="Enter ID details"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    error={errors.idNumber}
                    className="focus:border-teal/80"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <Button variant="primary-marigold" onClick={handleDetailsNext} className="flex items-center gap-1.5">
                Continue to Options <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: Select Add-ons */}
        {step === 1 && (
          <Card variant="default" className="space-y-6 text-left">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <h3 className="font-display font-bold text-sm uppercase text-marigold">
                Step 2: Add-on Configuration
              </h3>
              <Badge variant="info">Optional</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Insurance option */}
              <Card
                variant="interactive"
                onClick={() => setHasInsurance(!hasInsurance)}
                className={`flex gap-4 items-start ${
                  hasInsurance ? "border-marigold shadow-[0_0_12px_rgba(255,159,28,0.15)]" : "border-slate-800"
                }`}
              >
                <div className={`p-2 rounded bg-slate-800 text-slate-400 ${hasInsurance ? "text-marigold" : ""}`}>
                  <Shield size={20} />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary font-display uppercase">Trip Insurance</span>
                    <span className="font-data text-[10px] text-marigold">₹450</span>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">
                    Complete coverage on flight cancellations, luggage delays, and medical emergencies.
                  </p>
                </div>
              </Card>

              {/* Excess baggage option */}
              <Card
                variant="interactive"
                onClick={() => setHasLuggage(!hasLuggage)}
                className={`flex gap-4 items-start ${
                  hasLuggage ? "border-marigold shadow-[0_0_12px_rgba(255,159,28,0.15)]" : "border-slate-800"
                }`}
              >
                <div className={`p-2 rounded bg-slate-800 text-slate-400 ${hasLuggage ? "text-marigold" : ""}`}>
                  <Briefcase size={20} />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary font-display uppercase">+10kg Luggage</span>
                    <span className="font-data text-[10px] text-marigold">₹750</span>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">
                    Add extra weight allowance to your check-in baggage ledger.
                  </p>
                </div>
              </Card>

            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)} className="flex items-center gap-1">
                <ArrowLeft size={14} /> Back
              </Button>
              <Button variant="primary-marigold" onClick={handleAddonsNext} className="flex items-center gap-1.5">
                Go to Review <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 3: Review Itinerary */}
        {step === 2 && (
          <Card variant="default" className="space-y-6 text-left">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="font-display font-bold text-sm uppercase text-teal">
                Step 3: Verify Ledger Summary
              </h3>
            </div>

            {/* Recap info */}
            <div className="space-y-4 bg-[#111322] border border-slate-800 p-4 rounded-md">
              <div className="flex items-start gap-3">
                <Info size={16} className="text-teal mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="text-xs font-bold text-primary font-display uppercase">Vistara UK-811</span>
                  <p className="text-[10px] text-muted font-semibold">
                    New Delhi (DEL) ➔ Mumbai (BOM) • Economy Direct
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-300 font-semibold space-y-1">
                <div>Passenger: <span className="text-primary font-bold">{name}</span></div>
                <div>Contact: <span className="text-primary font-mono">{phone}</span> • <span className="text-primary font-mono">{email}</span></div>
                <div>Document: <span className="text-primary font-mono uppercase">{idType} - {idNumber}</span></div>
              </div>
            </div>

            {/* Price breakdown table */}
            <div className="space-y-3">
              <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
                Billing Breakdown
              </span>
              <table className="w-full text-[10px] font-data text-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-850">
                    <td className="py-2">Base Ticket Tariff</td>
                    <td className="py-2 text-right">₹{baseFare.toLocaleString()}</td>
                  </tr>
                  {hasInsurance && (
                    <tr className="border-b border-slate-850">
                      <td className="py-2">Trip Protection Cover</td>
                      <td className="py-2 text-right">₹{insurancePrice.toLocaleString()}</td>
                    </tr>
                  )}
                  {hasLuggage && (
                    <tr className="border-b border-slate-850">
                      <td className="py-2">+10kg Baggage Allowance</td>
                      <td className="py-2 text-right">₹{luggagePrice.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-850">
                    <td className="py-2">Taxes & Terminal Fees</td>
                    <td className="py-2 text-right">₹{taxPrice.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-display font-bold uppercase text-primary">Total Amount Due</td>
                    <td className="py-3 font-display font-extrabold text-xs text-marigold text-right">
                      ₹{totalPrice.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex items-center gap-1">
                <ArrowLeft size={14} /> Back
              </Button>
              <Button variant="primary-marigold" onClick={handleReviewConfirm} className="flex items-center gap-1.5">
                Continue to payment <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
