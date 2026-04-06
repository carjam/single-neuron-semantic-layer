import Script from "next/script";
import { Nav } from "@/components/Nav";

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
      <div className="border-t border-zinc-200">
        <Script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js" strategy="afterInteractive" />
        <redoc spec-url="/openapi.yaml" />
      </div>
    </div>
  );
}
