"use client";

/**
 * HomepageScene — Phase 2
 *
 * Renders the winding route-ribbon curve for the homepage hero with pins
 * representing Manali, Goa, Jaipur, Kerala, and Delhi.
 * Reuses the centralized <RouteRibbon> component.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { RouteRibbon, RibbonPin } from "@/components/RouteRibbon";

export function HomepageScene() {
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

  // 2. Winding hero waypoint pins: Manali, Goa, Jaipur, Kerala, Delhi
  const pins = useMemo(() => {
    const destinations = [
      { name: "Manali", subtitle: "Snowy peaks & adventure", t: 0.15 },
      { name: "Goa", subtitle: "Sun-kissed beaches", t: 0.35 },
      { name: "Jaipur", subtitle: "Royal fortresses & culture", t: 0.55 },
      { name: "Kerala", subtitle: "Serene backwaters", t: 0.75 },
      { name: "Delhi", subtitle: "Historic capital gateway", t: 0.90, isSpecial: true } // make Delhi the special glowing waypoint!
    ];

    return destinations.map((d, idx) => {
      const position = curve.getPointAt(d.t);
      return {
        id: `home-dest-${idx}`,
        name: d.name,
        subtitle: d.subtitle,
        position,
        t: d.t,
        isSpecial: !!d.isSpecial
      };
    });
  }, [curve]);

  return <RouteRibbon pins={pins} curve={curve} />;
}
