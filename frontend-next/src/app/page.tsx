"use client";

import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center p-8 text-center space-y-8">
      <div className="max-w-xl w-full space-y-4">
        <h1 className="font-display font-extrabold text-4xl text-marigold uppercase tracking-wide">
          Ghumne Chale 3D
        </h1>
        <p className="text-muted text-xs md:text-sm font-semibold max-w-md mx-auto leading-relaxed">
          Premium Flight & Hotel AI Trip Planner. The Next.js + React Three Fiber 3D rebuild environment.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg w-full">
        <Card variant="interactive" onClick={() => router.push("/dashboard")}>
          <h3 className="font-display font-bold text-sm uppercase text-teal">My Trips Dashboard</h3>
          <p className="text-[10px] text-muted mt-2">
            View completed travels, upcoming plans, and interactive 3D ledger path mapping.
          </p>
        </Card>

        <Card variant="interactive" onClick={() => router.push("/components-preview")}>
          <h3 className="font-display font-bold text-sm uppercase text-marigold">UI Component Library</h3>
          <p className="text-[10px] text-muted mt-2">
            Verify Phase 1 buttons, cards, selects, modals, badges, and indicator layouts.
          </p>
        </Card>
      </div>

      <div className="pt-4">
        <Button variant="ghost" onClick={() => window.location.href = "http://localhost:3000"}>
          ← Back to Legacy Terminal (Port 3000)
        </Button>
      </div>
    </div>
  );
}
