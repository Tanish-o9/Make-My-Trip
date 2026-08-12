/**
 * Ghumne Chale — Centralized Deterministic Vehicle Image Resolver
 * Provides reliable, deterministic vehicle model -> image mapping with zero random flickering.
 */

export interface VehicleLike {
  id?: number | string;
  brand?: string;
  model?: string;
  display_name?: string;
  type?: string;
  vehicle_type?: string;
  category?: string;
  image_key?: string;
  image?: string;
  image_url?: string;
  thumbnail_url?: string;
  [key: string]: any;
}

export const VEHICLE_IMAGES: Record<string, string> = {
  // Hatchbacks
  "swift": "/assets/vehicles/swift.webp",
  "grand-i10": "/assets/vehicles/grand-i10.webp",
  "i10": "/assets/vehicles/grand-i10.webp",
  "grand-i10-nios": "/assets/vehicles/grand-i10.webp",
  
  // Sedans
  "dzire": "/assets/vehicles/dzire.webp",
  "amaze": "/assets/vehicles/amaze.webp",
  "verna": "/assets/vehicles/verna.webp",
  
  // SUVs
  "creta": "/assets/vehicles/creta.webp",
  "seltos": "/assets/vehicles/seltos.webp",
  "xuv700": "/assets/vehicles/xuv700.webp",
  
  // MPVs
  "ertiga": "/assets/vehicles/ertiga.webp",
  "innova-crysta": "/assets/vehicles/innova-crysta.webp",
  "innova": "/assets/vehicles/innova-crysta.webp",
  "carens": "/assets/vehicles/carens.webp",
  
  // Luxury
  "camry": "/assets/vehicles/camry.webp",
  "mercedes": "/assets/vehicles/mercedes-e-class.webp",
  "mercedes-e-class": "/assets/vehicles/mercedes-e-class.webp",
  "e-class": "/assets/vehicles/mercedes-e-class.webp",
  
  // EV & Bikes
  "nexon-ev": "/assets/vehicles/nexon-ev.webp",
  "nexon": "/assets/vehicles/nexon-ev.webp",
  "activa": "/assets/vehicles/activa.webp",
  "activa-6g": "/assets/vehicles/activa.webp"
};

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  "hatchback": "/assets/vehicles/default-hatchback.webp",
  "sedan": "/assets/vehicles/default-sedan.webp",
  "suv": "/assets/vehicles/default-suv.webp",
  "mpv": "/assets/vehicles/default-mpv.webp",
  "xl": "/assets/vehicles/default-mpv.webp",
  "van": "/assets/vehicles/default-mpv.webp",
  "luxury": "/assets/vehicles/default-luxury.webp",
  "premium": "/assets/vehicles/default-luxury.webp",
  "ev": "/assets/vehicles/default-ev.webp",
  "electric": "/assets/vehicles/default-ev.webp",
  "bike": "/assets/vehicles/default-bike.webp",
  "scooter": "/assets/vehicles/default-bike.webp",
  "two_wheeler": "/assets/vehicles/default-bike.webp",
  "car": "/assets/vehicles/default-car.webp"
};

export const GENERIC_VEHICLE_FALLBACK = "/assets/vehicles/default-car.webp";

/**
 * Normalizes a raw string into a lookup key
 */
function normalizeKey(str?: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Deterministically resolves the correct vehicle image URL for any vehicle record
 */
export function getVehicleImage(vehicle?: VehicleLike | null): string {
  if (!vehicle) return GENERIC_VEHICLE_FALLBACK;

  // 1. Explicit image_key from backend
  if (vehicle.image_key) {
    const normKey = normalizeKey(vehicle.image_key);
    if (VEHICLE_IMAGES[normKey]) {
      return VEHICLE_IMAGES[normKey];
    }
  }

  // 2. Direct vehicle.image or vehicle.image_url if present and local asset
  const directImg = vehicle.image || vehicle.image_url || vehicle.thumbnail_url;
  if (directImg && typeof directImg === "string" && directImg.startsWith("/assets/vehicles/")) {
    return directImg;
  }

  // 3. Match by vehicle model / display name
  const modelName = normalizeKey(vehicle.model || vehicle.display_name || "");
  for (const [key, path] of Object.entries(VEHICLE_IMAGES)) {
    if (modelName.includes(key) || key.includes(modelName)) {
      return path;
    }
  }

  // 4. Match by brand + model
  const fullBrandModel = normalizeKey(`${vehicle.brand || ""} ${vehicle.model || ""}`);
  for (const [key, path] of Object.entries(VEHICLE_IMAGES)) {
    if (fullBrandModel.includes(key)) {
      return path;
    }
  }

  // 5. Fallback to category/type
  const categoryKey = normalizeKey(vehicle.category || vehicle.vehicle_type || vehicle.type || "");
  for (const [cat, path] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (categoryKey.includes(cat)) {
      return path;
    }
  }

  // 6. Generic safe fallback
  return GENERIC_VEHICLE_FALLBACK;
}

/**
 * Safe image onError handler to prevent infinite loops and gracefully switch to fallback
 */
export function handleVehicleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>, vehicle?: VehicleLike) {
  const target = e.currentTarget;
  const currentSrc = target.src;
  
  // Try category fallback if not already trying it
  const cat = (vehicle?.category || vehicle?.vehicle_type || vehicle?.type || "car").toLowerCase();
  const catFallback = CATEGORY_FALLBACK_IMAGES[cat] || GENERIC_VEHICLE_FALLBACK;
  
  if (!currentSrc.includes("default-") && currentSrc !== catFallback) {
    target.src = catFallback;
  } else if (!currentSrc.endsWith(GENERIC_VEHICLE_FALLBACK)) {
    target.src = GENERIC_VEHICLE_FALLBACK;
  }
}
