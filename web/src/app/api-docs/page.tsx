"use client";

import dynamic from "next/dynamic";
import { Nav } from "@/components/Nav";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <p className="px-4 py-10 text-sm text-zinc-500">Loading OpenAPI reference…</p>
  ),
});

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <Nav current="api-docs" />
      <p className="mx-auto max-w-6xl px-4 pb-2 pt-4 text-sm text-zinc-600">
        Interactive documentation generated from the{" "}
        <a href="/openapi.yaml" className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
          OpenAPI 3.0 spec
        </a>{" "}
        (<code className="rounded bg-zinc-100 px-1 text-xs">public/openapi.yaml</code>).
      </p>
      <div className="swagger-ui-override border-t border-zinc-200">
        <SwaggerUI url="/openapi.yaml" docExpansion="list" defaultModelExpandDepth={3} />
      </div>
    </div>
  );
}
