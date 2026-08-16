"use client";

/**
 * PaymentPage — Phase 6
 *
 * Sits as Step 4 (Index 3) of the booking checkout flow.
 * Reuses the step-ribbon BookingRibbonScene, Card, Button, and Badge from the shared library.
 * Implements mock success/failure checkout paths preserving original integration hooks.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Scene3D } from "@/components/Scene3D";
import { BookingRibbonScene } from "@/scenes/BookingRibbonScene";
import { Button, Card, Badge, StepIndicator } from "@/components/ui";
import { usePerformance } from "@/context/PerformanceGuard";
import { ShieldCheck, CreditCard, Wallet, QrCode, CheckCircle2, XCircle } from "lucide-react";

import { logFunnel } from "@/lib/telemetry";

export default function PaymentPage() {
  const router = useRouter();
  const { use3D } = usePerformance();

  // Load state from sessionStorage
  const [passengerName, setPassengerName] = useState("Traveler");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasLuggage, setHasLuggage] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("booking_details");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPassengerName(parsed.name || "Traveler");
        setHasInsurance(!!parsed.hasInsurance);
        setHasLuggage(!!parsed.hasLuggage);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // UI States: "checkout" | "success" | "failure"
  const [status, setStatus] = useState<"checkout" | "success" | "failure">("checkout");
  const [selectedMethod, setSelectedMethod] = useState("upi");

  // Price calculations
  const baseFare = 6200;
  const insurancePrice = 450;
  const luggagePrice = 750;
  const taxPrice = 1116;
  const totalPrice = baseFare + (hasInsurance ? insurancePrice : 0) + (hasLuggage ? luggagePrice : 0) + taxPrice;

  // Mock payment processing triggers
  const handleProcessPayment = (simulatedSuccess: boolean) => {
    setStatus("checkout"); // show loading state if needed
    setTimeout(() => {
      if (simulatedSuccess) {
        setStatus("success");
        logFunnel("payment_success", { value: totalPrice, method: selectedMethod });
      } else {
        setStatus("failure");
        logFunnel("payment_failure", { value: totalPrice, method: selectedMethod });
      }
    }, 800);
  };

  // 2D Static progress ribbon fallback
  const staticProgressFallback = (
    <div className="w-full h-12 bg-slate-900/30 rounded border border-slate-800 flex items-center justify-center relative overflow-hidden">
      <div className="w-2/3 h-1 bg-slate-800 rounded-full relative">
        <div
          className="h-full bg-teal transition-all duration-300"
          style={{ width: "100%" }}
        />
      </div>
      <span className="absolute bottom-1 right-2 text-[7px] font-data text-muted uppercase">
        2D Ribbon Line
      </span>
    </div>
  );

  const stepsLabel = ["Traveler Info", "Select Add-ons", "Verify details", "Payment Check"];

  return (
    <div className="min-h-screen bg-base text-primary font-body pb-12">
      <title>Payment Checkout | Ghumne Chale</title>
      <meta name="robots" content="noindex,nofollow" />
      {/* Top Navbar */}
      <nav className="border-b border-slate-900 bg-base/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display font-extrabold text-base tracking-wider text-primary uppercase flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
              ✈️ GHUMNE CHALE
            </span>
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
            Choose a payment method to complete the ledger transaction.
          </p>
        </div>

        {/* 3D step-ribbon decorator */}
        <div className="relative w-full rounded-lg overflow-hidden border border-slate-900 h-24 bg-slate-900/10">
          <Scene3D
            id="payment-ribbon"
            sceneContent={<BookingRibbonScene currentStep={3} />} // Step 3 indicates Step 4 (Payment) completed
            fallback={staticProgressFallback}
          />
          {use3D && <div className="w-full h-full pointer-events-none" />}
        </div>

        {/* Standard step indicator */}
        <StepIndicator currentStep={3} steps={stepsLabel} />

        {/* CHECKOUT STATE */}
        {status === "checkout" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            
            {/* Payment Method Select columns */}
            <div className="md:col-span-2 space-y-6">
              <Card variant="default" className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="font-display font-bold text-sm uppercase text-teal">
                    Select Payment Method
                  </h3>
                </div>

                <div className="space-y-3">
                  {/* UPI card */}
                  <Card
                    variant="interactive"
                    onClick={() => setSelectedMethod("upi")}
                    className={`flex items-center gap-4 ${
                      selectedMethod === "upi"
                        ? "border-marigold shadow-[0_0_12px_rgba(255,159,28,0.15)]"
                        : "border-slate-800"
                    }`}
                  >
                    <QrCode className={`text-slate-400 ${selectedMethod === "upi" ? "text-marigold" : ""}`} size={20} />
                    <div className="flex-1">
                      <span className="text-xs font-bold font-display uppercase block">BHIM UPI / GPAY / PHONEPE</span>
                      <span className="text-[9px] text-muted font-semibold">Pay instantly using any UPI handler app</span>
                    </div>
                  </Card>

                  {/* Credit Card */}
                  <Card
                    variant="interactive"
                    onClick={() => setSelectedMethod("card")}
                    className={`flex items-center gap-4 ${
                      selectedMethod === "card"
                        ? "border-marigold shadow-[0_0_12px_rgba(255,159,28,0.15)]"
                        : "border-slate-800"
                    }`}
                  >
                    <CreditCard className={`text-slate-400 ${selectedMethod === "card" ? "text-marigold" : ""}`} size={20} />
                    <div className="flex-1">
                      <span className="text-xs font-bold font-display uppercase block">Credit or Debit Card</span>
                      <span className="text-[9px] text-muted font-semibold">Visa, Mastercard, RuPay, Diners Club</span>
                    </div>
                  </Card>

                  {/* Wallet */}
                  <Card
                    variant="interactive"
                    onClick={() => setSelectedMethod("wallet")}
                    className={`flex items-center gap-4 ${
                      selectedMethod === "wallet"
                        ? "border-marigold shadow-[0_0_12px_rgba(255,159,28,0.15)]"
                        : "border-slate-800"
                    }`}
                  >
                    <Wallet className={`text-slate-400 ${selectedMethod === "wallet" ? "text-marigold" : ""}`} size={20} />
                    <div className="flex-1">
                      <span className="text-xs font-bold font-display uppercase block">Net Banking & Wallets</span>
                      <span className="text-[9px] text-muted font-semibold">Pay via top banks or online wallets</span>
                    </div>
                  </Card>
                </div>
              </Card>

              {/* Security trust badges */}
              <div className="flex items-center gap-3 bg-slate-900/20 border border-slate-850 p-4 rounded-lg text-muted">
                <ShieldCheck size={18} className="text-teal" />
                <span className="text-[9px] font-semibold leading-relaxed">
                  Ledger payments are fully encrypted and routed through PCI-DSS secure gateways. Authorized by Razorpay.
                </span>
              </div>
            </div>

            {/* Sidebar Pricing recap */}
            <div className="space-y-6">
              <Card variant="default" className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
                    Fare Breakdown
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-muted font-semibold uppercase">Total Amount Due</span>
                  <span className="font-data font-black text-2xl text-marigold block tracking-tight">
                    ₹{totalPrice.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 pt-2 text-[9px] text-slate-400 font-semibold border-t border-slate-850">
                  <div className="flex justify-between">
                    <span>Base Ticket Fare</span>
                    <span>₹{baseFare.toLocaleString()}</span>
                  </div>
                  {hasInsurance && (
                    <div className="flex justify-between">
                      <span>Insurance protection</span>
                      <span>₹{insurancePrice.toLocaleString()}</span>
                    </div>
                  )}
                  {hasLuggage && (
                    <div className="flex justify-between">
                      <span>luggage weight cover</span>
                      <span>₹{luggagePrice.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Taxes & Fees</span>
                    <span>₹{taxPrice.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-800">
                  <Button
                    variant="primary-marigold"
                    onClick={() => handleProcessPayment(true)}
                    className="w-full text-center"
                  >
                    Simulate Success Pay
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleProcessPayment(false)}
                    className="w-full text-center text-muted border-slate-850"
                  >
                    Simulate Failure Pay
                  </Button>
                </div>
              </Card>
            </div>

          </div>
        )}

        {/* SUCCESS STATE */}
        {status === "success" && (
          <Card variant="default" className="text-center p-8 space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mx-auto text-teal">
              <CheckCircle2 size={40} />
            </div>
            
            <div className="space-y-2">
              <Badge variant="upcoming">TRANSACTION COMPLETE</Badge>
              <h2 className="font-display font-extrabold text-xl uppercase tracking-tight text-primary">
                Booking Confirmed!
              </h2>
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Congratulations {passengerName}! Your ticket reservation ledger has been saved. Your boarding credentials will arrive via email.
              </p>
            </div>

            <div className="bg-[#111322] border border-slate-800 p-4 rounded-md space-y-1">
              <span className="text-[9px] font-display font-bold uppercase tracking-wider text-muted block">
                Booking Reference
              </span>
              <span className="font-data font-black text-sm text-[#F5F3EE] tracking-widest block uppercase">
                GC-882194
              </span>
            </div>

            <Button
              variant="primary-marigold"
              onClick={() => router.push("/dashboard")}
              className="w-full uppercase font-black tracking-wider text-xs"
            >
              View Booking Ledger
            </Button>
          </Card>
        )}

        {/* FAILURE STATE */}
        {status === "failure" && (
          <Card variant="default" className="text-center p-8 space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-chili/10 flex items-center justify-center mx-auto text-chili">
              <XCircle size={40} />
            </div>
            
            <div className="space-y-2">
              <Badge variant="cancelled">TRANSACTION DECLINED</Badge>
              <h2 className="font-display font-extrabold text-xl uppercase tracking-tight text-primary">
                Payment Verification Failed
              </h2>
              <p className="text-xs text-muted leading-relaxed font-semibold">
                The card issuing bank timed out or declined the session request. Make sure your account has sufficient limits or that your internet connection is stable.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                variant="primary-marigold"
                onClick={() => setStatus("checkout")}
                className="w-full uppercase font-black tracking-wider text-xs"
              >
                Try Payment Again
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedMethod("upi");
                  setStatus("checkout");
                }}
                className="w-full text-muted border-slate-850 uppercase font-bold text-xs"
              >
                Use UPI / Different Method
              </Button>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
