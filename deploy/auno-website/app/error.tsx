"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function Error({ reset }: { reset: () => void }) {
  useEffect(() => {
    toast.error("We couldn't load this page.", { description: "Please try again." });
  }, []);

  return (
    <main className="page-shell error-recovery">
      <p className="eyebrow">AUNO</p>
      <h1>Something went wrong.</h1>
      <p>Please try again. If the problem continues, return to the home page and start over.</p>
      <button className="button primary" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
