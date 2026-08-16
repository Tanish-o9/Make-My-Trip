"use client";

/**
 * DashboardScene — Phase 7
 *
 * Refactored to reuse the shared <RouteRibbon> component, keeping all
 * R3F shader flow, camera, and pin logics centralized.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { RouteRibbon, RibbonPin } from "@/components/RouteRibbon";

interface DashboardSceneProps {
  bookings: any[];
  upcomingTrip: any | null;
}

export function DashboardScene({ bookings = [], upcomingTrip }: DashboardSceneProps) {
  // 1. Define the identical winding curve path
  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(-6, -2, -5),
      new THREE.Vector3(-3, 1, -2),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(3, 2, -1),
      new THREE.Vector3(6, 0, -3),
    ];
    return new THREE.CatmullRomCurve3(points);
  }, []);

  // 2. Map user bookings to the ribbon pins schema
  const pins = useMemo(() => {
    const list: RibbonPin[] = [];
    
    // Past bookings
    const pastBookings = bookings.filter(
      (b) => b.status === "CONFIRMED" && b.booking_reference !== upcomingTrip?.booking_references?.[0]
    );
    
    pastBookings.slice(0, 3).forEach((b, idx) => {
      const t = 0.2 + idx * 0.2; // positions 0.2, 0.4, 0.6
      const position = curve.getPointAt(t);
      list.push({
        id: b.booking_reference,
        name: b.title || "Past Trip",
        subtitle: b.description || "",
        position,
        t,
        isSpecial: false,
      });
    });

    // Next upcoming booking
    if (upcomingTrip) {
      const t = 0.8;
      const position = curve.getPointAt(t);
      list.push({
        id: upcomingTrip.id || "upcoming",
        name: upcomingTrip.name || "Upcoming Journey",
        subtitle: upcomingTrip.start_date || "Soon",
        position,
        t,
        isSpecial: true,
      });
    }

    return list;
  }, [bookings, upcomingTrip, curve]);

  return <RouteRibbon pins={pins} curve={curve} />;
}
