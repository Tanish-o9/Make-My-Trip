"use client";

/**
 * ClientCanvasWrapper — Phase 10
 *
 * Client Component that dynamically imports PersistentCanvas with ssr: false.
 * This resolves Server Component restrictions on dynamic client-only chunks.
 */

import dynamic from "next/dynamic";

const PersistentCanvas = dynamic(
  () => import("./PersistentCanvas").then((mod) => mod.PersistentCanvas),
  { ssr: false }
);

export default function ClientCanvasWrapper() {
  return <PersistentCanvas />;
}
