"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    Redoc?: {
      init: (specOrSpecUrl: string, options: Record<string, unknown>, element: HTMLElement | null) => void;
    };
  }
}

export function RedocClient() {
  useEffect(() => {
    const init = () => {
      window.Redoc?.init("/openapi.yaml", {}, document.getElementById("redoc-container"));
    };

    if (window.Redoc) {
      init();
      return;
    }

    const onLoad = () => init();
    window.addEventListener("redoc-loaded", onLoad);
    return () => window.removeEventListener("redoc-loaded", onLoad);
  }, []);

  return (
    <div className="border-t border-zinc-200">
      <Script
        src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"
        strategy="afterInteractive"
        onLoad={() => window.dispatchEvent(new Event("redoc-loaded"))}
      />
      <div id="redoc-container" />
    </div>
  );
}
