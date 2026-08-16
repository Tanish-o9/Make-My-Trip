import type { Metadata } from "next";
import "./globals.css";
import { PerformanceGuard } from "@/context/PerformanceGuard";
import { SceneProvider } from "@/context/SceneContext";
import ClientCanvasWrapper from "@/components/ClientCanvasWrapper";

export const metadata: Metadata = {
  title: "Ghumne Chale - Premium Flight & Hotel AI Trip Planner",
  description: "AI-First Travel Planner with stunning 3D experiences",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased overflow-x-hidden">
        <PerformanceGuard>
          <SceneProvider>
            {/* The single persistent R3F Canvas */}
            <ClientCanvasWrapper />
            
            {/* The DOM overlay where standard Next.js page content renders */}
            <div id="page-root">
              {children}
            </div>
          </SceneProvider>
        </PerformanceGuard>
      </body>
    </html>
  );
}
