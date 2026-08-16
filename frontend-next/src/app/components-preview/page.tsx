"use client";

import { useState } from "react";
import { Button, Card, Input, Select, DatePicker, Badge, Skeleton, Modal, StepIndicator } from "@/components/ui";

export default function ComponentsPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-base text-primary p-8 space-y-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-marigold uppercase tracking-wide">
            Component Library Preview
          </h1>
          <p className="text-muted text-xs font-semibold mt-1">
            Ghumne Chale Phase 1 Shared Component Library (Tailwind v4 tokens)
          </p>
        </div>

        {/* Buttons section */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide border-b border-slate-800 pb-2">
            Buttons
          </h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary-marigold">Primary Marigold</Button>
            <Button variant="secondary-teal">Secondary Teal</Button>
            <Button variant="destructive-chili">Destructive Chili</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button disabled variant="primary-marigold">Disabled Button</Button>
          </div>
        </section>

        {/* Cards section */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide border-b border-slate-800 pb-2">
            Cards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="default">
              <h3 className="font-display font-bold text-sm uppercase text-marigold">Default Card</h3>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Standard background surface container used for grouping info.
              </p>
            </Card>
            <Card variant="interactive">
              <h3 className="font-display font-bold text-sm uppercase text-teal">Interactive Card</h3>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Supports hover scale and glow. Hover me to test!
              </p>
            </Card>
            <Card variant="status">
              <h3 className="font-display font-bold text-sm uppercase text-primary">Status Card</h3>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Features a solid teal left indicator bar for stateful blocks.
              </p>
            </Card>
          </div>
        </section>

        {/* Inputs section */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide border-b border-slate-800 pb-2">
            Form Fields
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="Text Input" placeholder="Type something..." />
            <Select
              label="Select Options"
              options={[
                { value: "1", label: "Option 1" },
                { value: "2", label: "Option 2" },
                { value: "3", label: "Option 3" },
              ]}
            />
            <DatePicker label="Travel Date" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input label="Input with Error" placeholder="Errors look like this" error="Invalid credentials" />
          </div>
        </section>

        {/* Badges and Skeletons section */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide border-b border-slate-800 pb-2">
            Badges & Loading states
          </h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Badge variant="upcoming">Upcoming</Badge>
            <Badge variant="completed">Completed</Badge>
            <Badge variant="cancelled">Cancelled</Badge>
            <Badge variant="info">Info Badge</Badge>
          </div>
          <div className="space-y-3 max-w-sm pt-2">
            <Skeleton variant="line" className="w-2/3" />
            <Skeleton variant="line" className="w-full" />
            <div className="flex items-center gap-3">
              <Skeleton variant="avatar" />
              <div className="flex-1 space-y-1">
                <Skeleton variant="line" className="w-1/2 h-3" />
                <Skeleton variant="line" className="w-3/4 h-2" />
              </div>
            </div>
          </div>
        </section>

        {/* Step Indicator */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide border-b border-slate-800 pb-2">
            Step Indicator
          </h2>
          <StepIndicator
            currentStep={step}
            steps={["Details", "Add-ons", "Review", "Payment"]}
          />
          <div className="flex gap-2 justify-center">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Prev Step
            </Button>
            <Button variant="ghost" onClick={() => setStep((s) => Math.min(3, s + 1))}>
              Next Step
            </Button>
          </div>
        </section>

        {/* Modals section */}
        <section className="space-y-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-wide border-b border-slate-800 pb-2">
            Modals
          </h2>
          <div>
            <Button variant="secondary-teal" onClick={() => setModalOpen(true)}>
              Open Demo Modal
            </Button>
          </div>
          <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Demo Modal Window">
            <p className="text-xs text-muted leading-relaxed">
              This is a custom modal utilizing framer-motion for smooth spring-based entry and exit transitions.
              It respects the dark base palette and is perfect for overlays like terms or details.
            </p>
            <div className="mt-6 flex justify-end">
              <Button variant="primary-marigold" onClick={() => setModalOpen(false)}>
                Got it
              </Button>
            </div>
          </Modal>
        </section>
      </div>
    </div>
  );
}
