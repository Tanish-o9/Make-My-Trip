export const resolveApiBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      let url = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      if (url.includes("make-my-trip-production.up.railway.app")) {
        url = "http://localhost:8000/api";
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (url.endsWith("/v1")) {
        url = url.slice(0, -3);
      }
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }
      if (!url.endsWith("/api")) {
        url = `${url}/api`;
      }
      return url;
    } else {
      return `${window.location.origin}/api`;
    }
  }
  return "http://localhost:8000/api";
};

export const API_BASE = resolveApiBase();
export const API_URL = `${API_BASE}/v1`;

export const resolveWsBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return API_BASE.replace(/^http/, "ws");
    } else {
      const envUrl = import.meta.env.VITE_API_URL;
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        let wsUrl = envUrl.replace(/^http/, "ws");
        if (wsUrl.endsWith("/")) wsUrl = wsUrl.slice(0, -1);
        if (wsUrl.endsWith("/api")) return wsUrl;
        return `${wsUrl}/api`;
      }
      return "wss://make-my-trip-production.up.railway.app/api";
    }
  }
  return "ws://localhost:8000/api";
};

export const resolveWsAdminBase = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return API_BASE.replace(/^http/, "ws").replace(/\/api$/, "/ws");
    } else {
      const envUrl = import.meta.env.VITE_API_URL;
      if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
        let wsUrl = envUrl.replace(/^http/, "ws");
        if (wsUrl.endsWith("/")) wsUrl = wsUrl.slice(0, -1);
        if (wsUrl.endsWith("/api")) wsUrl = wsUrl.slice(0, -4);
        return `${wsUrl}/ws`;
      }
      return "wss://make-my-trip-production.up.railway.app/ws";
    }
  }
  return "ws://localhost:8000/ws";
};

export const WS_BASE_API = resolveWsBase();
export const WS_BASE_ADMIN = resolveWsAdminBase();


export const resolveAdminBase = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/admin`;
  }
  return "http://localhost:5173/admin";
};

export const ADMIN_BASE = resolveAdminBase();

export const SPECIAL_FARES: Record<string, { discountPercent: number; minimumAge?: number; label: string }> = {
  regular: { discountPercent: 0, label: "Regular" },
  student: { discountPercent: 10, label: "Student" },
  senior: { discountPercent: 5, minimumAge: 60, label: "Senior Citizen" },
  armed_forces: { discountPercent: 10, label: "Armed Forces" }
};

export const validateStudentDetails = (p: {
  fullName: string;
  age: string | number;
  studentId?: string;
  studentName?: string;
  institutionName?: string;
  institutionCity?: string;
  studentCourse?: string;
  studentDateOfBirth?: string;
  studentEmail?: string;
}) => {
  const studentId = (p.studentId || "").trim();
  const studentName = (p.studentName || "").trim();
  const institutionName = (p.institutionName || "").trim();
  const institutionCity = (p.institutionCity || "").trim();
  const studentCourse = (p.studentCourse || "").trim();
  const studentDateOfBirth = (p.studentDateOfBirth || "").trim();
  const studentEmail = (p.studentEmail || "").trim();
  
  if (!studentId || !studentName || !institutionName || !institutionCity || !studentCourse || !studentDateOfBirth || !studentEmail) {
    return { valid: false, reason: "All student verification fields are required." };
  }
  
  if (studentId.length < 3) {
    return { valid: false, reason: "Student ID must be at least 3 characters long." };
  }
  
  const lowerId = studentId.toLowerCase();
  const lowerName = studentName.toLowerCase();
  const lowerInst = institutionName.toLowerCase();
  const placeholders = ["test", "fake", "placeholder", "12345", "abcd", "none", "null", "student"];
  if (placeholders.some(pl => lowerId === pl || lowerName === pl || lowerInst.includes(pl))) {
    return { valid: false, reason: "Please enter real details (avoid placeholder text)." };
  }
  
  const dobDate = new Date(studentDateOfBirth);
  if (isNaN(dobDate.getTime())) {
    return { valid: false, reason: "Invalid Date of Birth." };
  }
  
  const age = parseInt(String(p.age), 10) || 0;
  if (age < 5 || age > 30) {
    return { valid: false, reason: `Age (${age}) must be between 5 and 30 for student fare.` };
  }
  
  const pNameLower = p.fullName.toLowerCase().replace(/\s+/g, "");
  const sNameLower = studentName.toLowerCase().replace(/\s+/g, "");
  if (!pNameLower.includes(sNameLower) && !sNameLower.includes(pNameLower)) {
    return { valid: false, reason: "Student name must match passenger name." };
  }
  
  if (!/\S+@\S+\.\S+/.test(studentEmail)) {
    return { valid: false, reason: "Invalid student email address." };
  }
  
  return { valid: true };
};

export const calculatePassengerFare = (
  baseFare: number,
  specialFareType: string,
  age: number,
  studentId: string,
  serviceId: string,
  passengerObj?: any
) => {
  const rule = SPECIAL_FARES[specialFareType] || SPECIAL_FARES.regular;
  let discountPercent = 0;
  
  if (specialFareType === "student") {
    if (passengerObj) {
      const val = validateStudentDetails(passengerObj);
      if (val.valid) {
        discountPercent = rule.discountPercent;
      }
    } else if (studentId.trim()) {
      discountPercent = rule.discountPercent;
    }
  } else if (specialFareType === "senior" && age >= (rule.minimumAge || 60)) {
    discountPercent = rule.discountPercent;
  } else if (specialFareType === "armed_forces" && serviceId.trim()) {
    discountPercent = rule.discountPercent;
  }
  
  const discountAmount = Math.round(baseFare * (discountPercent / 100));
  const finalFare = baseFare - discountAmount;
  
  return {
    baseFare,
    discountPercent,
    discountAmount,
    finalFare
  };
};

export const SPECIAL_FARE_KEY_MAP: Record<string, string> = {
  "Regular": "regular",
  "regular": "regular",
  "Student": "student",
  "student": "student",
  "Senior Citizen": "senior",
  "Senior": "senior",
  "senior": "senior",
  "Armed Forces": "armed_forces",
  "armed_forces": "armed_forces"
};

export const normalizeSpecialFareKey = (nameOrKey: string): string => {
  if (!nameOrKey) return "regular";
  const mapped = SPECIAL_FARE_KEY_MAP[nameOrKey];
  if (mapped) return mapped;
  const lower = nameOrKey.toLowerCase().trim();
  if (lower.includes("student")) return "student";
  if (lower.includes("senior")) return "senior";
  if (lower.includes("armed")) return "armed_forces";
  return "regular";
};

export const calculateSearchDisplayFare = (baseFare: number, specialFareTypeOrName: string) => {
  const fareKey = normalizeSpecialFareKey(specialFareTypeOrName);
  const rule = SPECIAL_FARES[fareKey] || SPECIAL_FARES.regular;
  const discountPercent = rule.discountPercent || 0;
  const discountAmount = Math.round(baseFare * (discountPercent / 100));
  const finalFare = Math.max(0, baseFare - discountAmount);
  return {
    fareKey,
    label: rule.label,
    originalFare: baseFare,
    discountPercent,
    discountAmount,
    finalFare
  };
};

