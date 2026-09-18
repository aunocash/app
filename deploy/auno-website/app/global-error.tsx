"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export default function GlobalError({ reset }: { reset: () => void }) {
  useEffect(() => {
    toast.error("We couldn't load AUNO.", { description: "Please try again." });
  }, []);

  return (
    <html lang="en">
      <body style={{ background: "#090b0f", color: "#f5f5f3", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Toaster />
        <main style={{ margin: "0 auto", maxWidth: 640, padding: "96px 24px" }}>
          <p style={{ color: "#ffb27d", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em" }}>AUNO</p>
          <h1 style={{ fontSize: 36, margin: "12px 0" }}>Something went wrong.</h1>
          <p style={{ color: "#a5a8ad", lineHeight: 1.6 }}>Please try again. If the problem continues, return to the home page and start over.</p>
          <button type="button" onClick={reset} style={{ background: "#fd6c03", border: 0, borderRadius: 10, color: "#0d0f12", cursor: "pointer", fontWeight: 700, marginTop: 24, padding: "12px 16px" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
