import os

VEHICLES = [
    {
        "key": "swift",
        "name": "Maruti Suzuki Swift",
        "category": "HATCHBACK",
        "badge": "Agile & Compact Mini",
        "color1": "#E11D48", "color2": "#9F1239", "bg1": "#1E1B4B", "bg2": "#0F172A",
        "icon": "🚗",
        "shape": "hatchback"
    },
    {
        "key": "grand-i10",
        "name": "Hyundai Grand i10 Nios",
        "category": "HATCHBACK",
        "badge": "Urban City Hatch",
        "color1": "#0284C7", "color2": "#0369A1", "bg1": "#0C4A6E", "bg2": "#0F172A",
        "icon": "🚗",
        "shape": "hatchback"
    },
    {
        "key": "dzire",
        "name": "Maruti Suzuki Dzire",
        "category": "SEDAN",
        "badge": "India's #1 Prime Sedan",
        "color1": "#F59E0B", "color2": "#D97706", "bg1": "#312E81", "bg2": "#1E1B4B",
        "icon": "🚘",
        "shape": "sedan"
    },
    {
        "key": "amaze",
        "name": "Honda Amaze",
        "category": "SEDAN",
        "badge": "Executive Comfort Sedan",
        "color1": "#6366F1", "color2": "#4338CA", "bg1": "#1E293B", "bg2": "#0F172A",
        "icon": "🚘",
        "shape": "sedan"
    },
    {
        "key": "verna",
        "name": "Hyundai Verna Turbo",
        "category": "SEDAN",
        "badge": "Futuristic Fastback Sedan",
        "color1": "#8B5CF6", "color2": "#6D28D9", "bg1": "#2E1065", "bg2": "#0F172A",
        "icon": "🏎️",
        "shape": "sedan"
    },
    {
        "key": "creta",
        "name": "Hyundai Creta",
        "category": "SUV",
        "badge": "King of Compact SUVs",
        "color1": "#10B981", "color2": "#047857", "bg1": "#064E3B", "bg2": "#0F172A",
        "icon": "🚙",
        "shape": "suv"
    },
    {
        "key": "seltos",
        "name": "Kia Seltos",
        "category": "SUV",
        "badge": "Sporty All-Terrain SUV",
        "color1": "#F97316", "color2": "#C2410C", "bg1": "#431407", "bg2": "#0F172A",
        "icon": "🚙",
        "shape": "suv"
    },
    {
        "key": "xuv700",
        "name": "Mahindra XUV700",
        "category": "SUV",
        "badge": "Flagship 7-Seater AWD SUV",
        "color1": "#EC4899", "color2": "#BE185D", "bg1": "#500724", "bg2": "#0F172A",
        "icon": "🚙",
        "shape": "suv"
    },
    {
        "key": "ertiga",
        "name": "Maruti Suzuki Ertiga",
        "category": "MPV",
        "badge": "Family 6-Seater Cruiser",
        "color1": "#14B8A6", "color2": "#0F766E", "bg1": "#134E4A", "bg2": "#0F172A",
        "icon": "🚐",
        "shape": "mpv"
    },
    {
        "key": "innova-crysta",
        "name": "Toyota Innova Crysta",
        "category": "MPV",
        "badge": "Legendary Touring MPV",
        "color1": "#EAB308", "color2": "#CA8A04", "bg1": "#422006", "bg2": "#0F172A",
        "icon": "🚐",
        "shape": "mpv"
    },
    {
        "key": "carens",
        "name": "Kia Carens",
        "category": "MPV",
        "badge": "Premium 7S Recreational MPV",
        "color1": "#3B82F6", "color2": "#1D4ED8", "bg1": "#1E3A8A", "bg2": "#0F172A",
        "icon": "🚐",
        "shape": "mpv"
    },
    {
        "key": "camry",
        "name": "Toyota Camry Hybrid",
        "category": "LUXURY",
        "badge": "VIP Hybrid Luxury Chauffeur",
        "color1": "#D97706", "color2": "#B45309", "bg1": "#18181B", "bg2": "#09090B",
        "icon": "✨",
        "shape": "luxury"
    },
    {
        "key": "mercedes-e-class",
        "name": "Mercedes-Benz E-Class",
        "category": "LUXURY",
        "badge": "Ultra Premium Chauffeur Limousine",
        "color1": "#94A3B8", "color2": "#64748B", "bg1": "#09090B", "bg2": "#000000",
        "icon": "👑",
        "shape": "luxury"
    },
    {
        "key": "nexon-ev",
        "name": "Tata Nexon EV",
        "category": "EV",
        "badge": "Zero Emission Electric Smart Cabs",
        "color1": "#06B6D4", "color2": "#0891B2", "bg1": "#164E63", "bg2": "#083344",
        "icon": "⚡",
        "shape": "ev"
    },
    {
        "key": "activa",
        "name": "Honda Activa 6G",
        "category": "BIKE",
        "badge": "Quick Solo City Ride",
        "color1": "#F43F5E", "color2": "#E11D48", "bg1": "#4C0519", "bg2": "#0F172A",
        "icon": "🛵",
        "shape": "bike"
    },
    # Fallback categories
    {
        "key": "default-hatchback",
        "name": "Hatchback Fleet",
        "category": "HATCHBACK",
        "badge": "Compact Economical City Ride",
        "color1": "#FB7185", "color2": "#E11D48", "bg1": "#1E1B4B", "bg2": "#0F172A",
        "icon": "🚗",
        "shape": "hatchback"
    },
    {
        "key": "default-sedan",
        "name": "Sedan Fleet",
        "category": "SEDAN",
        "badge": "Comfortable Sedan for Business & Family",
        "color1": "#38BDF8", "color2": "#0284C7", "bg1": "#0C4A6E", "bg2": "#0F172A",
        "icon": "🚘",
        "shape": "sedan"
    },
    {
        "key": "default-suv",
        "name": "SUV Fleet",
        "category": "SUV",
        "badge": "Spacious SUV for Highway & Hills",
        "color1": "#34D399", "color2": "#059669", "bg1": "#064E3B", "bg2": "#0F172A",
        "icon": "🚙",
        "shape": "suv"
    },
    {
        "key": "default-mpv",
        "name": "MPV & XL Fleet",
        "category": "MPV",
        "badge": "Extra Seating & Large Boot Space",
        "color1": "#FBBF24", "color2": "#D97706", "bg1": "#451A03", "bg2": "#0F172A",
        "icon": "🚐",
        "shape": "mpv"
    },
    {
        "key": "default-luxury",
        "name": "Luxury Fleet",
        "category": "LUXURY",
        "badge": "First Class Chauffeur Driven Fleet",
        "color1": "#F59E0B", "color2": "#B45309", "bg1": "#18181B", "bg2": "#000000",
        "icon": "✨",
        "shape": "luxury"
    },
    {
        "key": "default-ev",
        "name": "Electric Fleet",
        "category": "EV",
        "badge": "Eco-Friendly Electric Mobility",
        "color1": "#22D3EE", "color2": "#0891B2", "bg1": "#083344", "bg2": "#0F172A",
        "icon": "⚡",
        "shape": "ev"
    },
    {
        "key": "default-bike",
        "name": "Bike Taxi",
        "category": "BIKE",
        "badge": "Fastest Way to Beat Traffic",
        "color1": "#FB7185", "color2": "#BE123C", "bg1": "#4C0519", "bg2": "#0F172A",
        "icon": "🛵",
        "shape": "bike"
    },
    {
        "key": "default-car",
        "name": "Ghumne Chale Verified Cab",
        "category": "CAR",
        "badge": "Safe & Sanitized Verified Fleet",
        "color1": "#60A5FA", "color2": "#2563EB", "bg1": "#1E3A8A", "bg2": "#0F172A",
        "icon": "🚕",
        "shape": "sedan"
    }
]

def generate_svg(v):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{v['bg1']}" />
      <stop offset="100%" stop-color="{v['bg2']}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="{v['color1']}" />
      <stop offset="100%" stop-color="{v['color2']}" />
    </linearGradient>
    <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.25" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.4" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="800" height="450" fill="url(#bgGrad)" rx="20"/>
  
  <!-- Subtle Grid & Radial Overlay -->
  <g opacity="0.06">
    <circle cx="400" cy="225" r="300" fill="none" stroke="#ffffff" stroke-width="2"/>
    <circle cx="400" cy="225" r="200" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="8 8"/>
    <circle cx="400" cy="225" r="100" fill="none" stroke="#ffffff" stroke-width="1"/>
    <path d="M 0 225 L 800 225 M 400 0 L 400 450" stroke="#ffffff" stroke-width="1"/>
  </g>

  <!-- Ambient Glow Behind Vehicle -->
  <circle cx="400" cy="240" r="140" fill="{v['color1']}" opacity="0.22" filter="url(#glow)"/>

  <!-- Top Category Chip & Branding Header -->
  <g transform="translate(40, 40)">
    <rect x="0" y="0" width="130" height="30" rx="15" fill="url(#accentGrad)" opacity="0.95"/>
    <text x="65" y="19" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="1.5">{v['category']}</text>
    
    <text x="720" y="20" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" text-anchor="end" letter-spacing="1">GHUMNE CHALE FLEET</text>
  </g>

  <!-- Central Graphic Showcase -->
  <g transform="translate(400, 220)" filter="url(#shadow)">
    <!-- Road / Platform Base -->
    <ellipse cx="0" cy="65" rx="260" ry="22" fill="#000000" opacity="0.5"/>
    <ellipse cx="0" cy="65" rx="180" ry="12" fill="{v['color1']}" opacity="0.3"/>

    <!-- Central Icon/Symbol Disc -->
    <circle cx="0" cy="-20" r="85" fill="#1E293B" stroke="{v['color1']}" stroke-width="3" opacity="0.9"/>
    <circle cx="0" cy="-20" r="85" fill="url(#metalGrad)"/>
    <text x="0" y="15" font-size="76" text-anchor="middle" dominant-baseline="central">{v['icon']}</text>
  </g>

  <!-- Vehicle Identification & Badge Footer -->
  <g transform="translate(40, 360)">
    <text x="0" y="0" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="800">{v['name']}</text>
    <text x="0" y="28" fill="{v['color1']}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" letter-spacing="0.5">✦ {v['badge']}</text>
  </g>

  <!-- Verified Watermark Badge -->
  <g transform="translate(760, 385)">
    <rect x="-150" y="-20" width="150" height="32" rx="8" fill="#0F172A" stroke="#334155" stroke-width="1"/>
    <circle cx="-132" cy="-4" r="6" fill="#10B981"/>
    <text x="-116" y="1" fill="#E2E8F0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700">100% Guaranteed</text>
  </g>
</svg>
"""

def run():
    target_dirs = [
        os.path.abspath(r"c:\Users\tanis\OneDrive\Desktop\Make My Trip\frontend\public\assets\vehicles"),
        os.path.abspath(r"c:\Users\tanis\OneDrive\Desktop\Make My Trip\frontend\dist\assets\vehicles")
    ]
    for d in target_dirs:
        os.makedirs(d, exist_ok=True)
        for v in VEHICLES:
            svg_content = generate_svg(v)
            # Write .svg
            svg_path = os.path.join(d, f"{v['key']}.svg")
            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            # Write .webp compatible alias (serving svg directly works seamlessly across all modern browsers)
            webp_path = os.path.join(d, f"{v['key']}.webp")
            with open(webp_path, "w", encoding="utf-8") as f:
                f.write(svg_content)
            print(f"Generated {v['key']}.svg/.webp in {d}")

if __name__ == "__main__":
    run()
