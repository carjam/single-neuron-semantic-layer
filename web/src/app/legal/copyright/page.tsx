import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";
import { LEGAL_COPYRIGHT_YEARS, LEGAL_EMAIL, LEGAL_OWNER, PROJECT_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Copyright",
  description: "Copyright and proprietary license notice for the semantic layer portfolio demonstration.",
};

export default function CopyrightPage() {
  return (
    <LegalDocument title="Copyright notice">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The {PROJECT_NAME} repository, web experience, SQL, API, documentation, and all related materials are
        proprietary works owned by {LEGAL_OWNER}.
      </p>

      <LegalSection title="All rights reserved">
        <p>
          Copyright © {LEGAL_COPYRIGHT_YEARS} {LEGAL_OWNER}. All rights reserved.
        </p>
        <p>
          No part of this project may be reproduced, distributed, modified, or used for any purpose other than
          permitted viewing and evaluation without prior written consent from the copyright holder.
        </p>
      </LegalSection>

      <LegalSection title="Viewing permission">
        <p>You may view and evaluate this project, including through the interactive web demo, for purposes such as:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Portfolio review by potential employers or clients</li>
          <li>Technical assessment during interviews or hiring processes</li>
          <li>Educational study and code-quality review</li>
        </ul>
      </LegalSection>

      <LegalSection title="Restrictions">
        <p>Without explicit written permission, you may not:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Use the software, SQL, API, or demo data for personal, academic, or commercial purposes</li>
          <li>Copy, modify, adapt, or create derivative works</li>
          <li>Distribute, sublicense, lease, sell, or transfer any portion of the project</li>
          <li>Reverse engineer, decompile, or disassemble the software</li>
        </ul>
      </LegalSection>

      <LegalSection title="Commercial licensing">
        <p>
          Commercial use, embedding in production systems, or redistribution requires a separate written license.
          Contact{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            {LEGAL_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          This project is provided &quot;as is&quot; without warranty of any kind, express or implied, including
          merchantability, fitness for a particular purpose, and non-infringement. The copyright holder shall not be
          liable for any claim, damages, or other liability arising from use of or inability to use the project.
        </p>
      </LegalSection>

      <LegalSection title="Enforcement">
        <p>
          Unauthorized use may result in legal action. The copyright holder reserves all rights to enforce this notice
          and the repository LICENSE file to the fullest extent permitted by law.
        </p>
        <p className="text-xs text-zinc-500">
          The full legal text is in the <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">LICENSE</code> file
          at the repository root.
        </p>
      </LegalSection>

      <LegalSection title="Third-party trademarks">
        <p>
          Aladdin® is a registered trademark of BlackRock, Inc. This project is not affiliated with, endorsed by, or
          sponsored by BlackRock or any other vendor. Demo securities, ISINs, and vendor-style field names are
          synthetic and illustrative only.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
