import React from "react";
import { ArrowLeft } from "lucide-react";

interface DesignTokensPageProps {
  onNavigate: (path: string) => void;
}

export function DesignTokensPage({ onNavigate }: DesignTokensPageProps) {
  const colors = [
    { name: "Obsidian", value: "#0B0E14", var: "--color-obsidian", desc: "Base background color" },
    { name: "Surface", value: "#131A29", var: "--color-surface", desc: "Card and panel background" },
    { name: "Surface Raised", value: "#1C2438", var: "--color-surface-raised", desc: "Hover state card/panel background" },
    { name: "Gold", value: "#C9A24B", var: "--color-gold", desc: "Primary accent (CTAs, active states, prices)" },
    { name: "Gold Muted", value: "#8A7239", var: "--color-gold-muted", desc: "Secondary/disabled gold borders" },
    { name: "Ivory", value: "#F3EFE6", var: "--color-ivory", desc: "Primary text color" },
    { name: "Ivory Dim", value: "#A8A296", var: "--color-ivory-dim", desc: "Secondary/disabled text color" },
    { name: "Teal", value: "#2E6B63", var: "--color-teal", desc: "Secondary accent / success states" },
    { name: "Red", value: "#C1443B", var: "--color-red", desc: "Error alerts & special discounts (sparingly)" },
  ];

  const typography = [
    { name: "Hero", sample: "Fraunces Display", class: "text-5xl font-serif", val: "clamp(3rem, 7vw, 5.5rem)" },
    { name: "Heading 1", sample: "FRAUNCES H1 TITLE", class: "text-3xl font-serif", val: "clamp(2rem, 5vw, 3rem)" },
    { name: "Heading 2", sample: "Fraunces H2 Subtitle", class: "text-2xl font-serif", val: "clamp(1.5rem, 4vw, 2.25rem)" },
    { name: "Heading 3", sample: "General Sans H3 Header", class: "text-xl font-sans font-semibold", val: "clamp(1.25rem, 3vw, 1.75rem)" },
    { name: "Body", sample: "General Sans Body text for normal copy blocks, descriptions, and lists.", class: "text-base font-sans", val: "1rem" },
    { name: "Caption", sample: "General Sans small caption text for terms and indicators.", class: "text-xs font-sans", val: "0.85rem" },
    { name: "Data / Monospace", sample: "DEL -> BOM | ₹24,500 | PNR: 49918", class: "text-sm font-mono", val: "0.9rem" },
  ];

  const spacing = [
    { name: "space-1", val: "4px" },
    { name: "space-2", val: "8px" },
    { name: "space-3", val: "12px" },
    { name: "space-4", val: "16px" },
    { name: "space-6", val: "24px" },
    { name: "space-8", val: "32px" },
    { name: "space-12", val: "48px" },
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3EFE6] p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <h1 className="text-4xl font-serif italic text-[#C9A24B]">Ghumne Chale Design System</h1>
            <p className="text-sm text-[#A8A296]">Tokens, Colors, Spacing & Typography Reference Guide</p>
          </div>
          <button 
            onClick={() => onNavigate("/")} 
            className="flex items-center gap-2 border border-[#C9A24B] text-[#C9A24B] hover:bg-[#C9A24B]/10 px-4 py-2 text-xs font-bold rounded cursor-pointer transition-all"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>

        {/* Color Palette Swatches */}
        <div className="space-y-4">
          <h2 className="text-2xl font-serif border-b border-slate-800 pb-2">Color Palette Swatches</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {colors.map((color) => (
              <div key={color.name} className="bg-[#131A29] border border-slate-800 rounded-lg overflow-hidden shadow-lg flex flex-col justify-between">
                <div 
                  className="h-24 w-full" 
                  style={{ backgroundColor: color.value }}
                />
                <div className="p-4 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm">{color.name}</span>
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded font-mono text-[#C9A24B]">{color.value}</span>
                  </div>
                  <code className="text-xs text-[#A8A296] font-mono">{color.var}</code>
                  <p className="text-xs text-[#A8A296] pt-1">{color.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography Scale */}
        <div className="space-y-4">
          <h2 className="text-2xl font-serif border-b border-slate-800 pb-2">Typography & Scale</h2>
          <div className="bg-[#131A29] border border-slate-800 rounded-lg divide-y divide-slate-800">
            {typography.map((type) => (
              <div key={type.name} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xs">
                  <span className="text-xs font-bold uppercase text-[#C9A24B]">{type.name}</span>
                  <div className="text-xs text-[#A8A296] font-mono">Size: {type.val}</div>
                </div>
                <div className={`${type.class} text-[#F3EFE6] max-w-xl flex-1`}>
                  {type.sample}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spacing & Layout Tokens */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="space-y-4">
            <h2 className="text-2xl font-serif border-b border-slate-800 pb-2">Spacing Scale</h2>
            <div className="bg-[#131A29] border border-slate-800 rounded-lg p-6 space-y-4">
              {spacing.map((space) => (
                <div key={space.name} className="flex items-center gap-4">
                  <span className="w-20 text-xs font-mono text-[#A8A296]">{space.name} ({space.val})</span>
                  <div 
                    className="bg-[#C9A24B] h-4 rounded-sm"
                    style={{ width: space.val }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-serif border-b border-slate-800 pb-2">Borders & Elevation</h2>
            <div className="bg-[#131A29] border border-slate-800 rounded-lg p-6 space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-[#C9A24B]">Border Radius</span>
                <div className="flex gap-4">
                  <div className="w-24 h-16 border border-[#C9A24B] rounded-[4px] flex items-center justify-center text-xs font-mono text-[#A8A296]">
                    --radius-card (4px)
                  </div>
                  <div className="w-24 h-16 border border-[#C9A24B] rounded-[2px] flex items-center justify-center text-xs font-mono text-[#A8A296]">
                    --radius-inner (2px)
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-[#C9A24B]">Elevations</span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#A8A296]">
                  <div className="p-3 bg-[#131A29] border border-slate-800 rounded shadow-sm">shadow-sm</div>
                  <div className="p-3 bg-[#131A29] border border-slate-800 rounded shadow-md">shadow-md</div>
                  <div className="p-3 bg-[#131A29] border border-slate-800 rounded shadow-lg">shadow-lg</div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
