import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "API reference (OpenAPI)",
  description: "OpenAPI 3 specification and interactive docs for the semantic layer demo REST API",
};

export default function ApiDocsLayout({ children }: { children: ReactNode }) {
  return children;
}
