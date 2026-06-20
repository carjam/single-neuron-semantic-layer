import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";
import { LEGAL_EMAIL, LEGAL_OWNER, PROJECT_NAME, SITE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of the semantic layer portfolio demonstration website and API.",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the {SITE_NAME} website, API, and
        related materials (collectively, the &quot;Service&quot;) operated by {LEGAL_OWNER} as a portfolio
        demonstration of the {PROJECT_NAME}.
      </p>

      <LegalSection title="1. Acceptance">
        <p>
          By accessing or using the Service, you agree to these Terms and our{" "}
          <Link href="/legal/privacy" className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Nature of the Service">
        <p>
          The Service is an <strong className="font-medium text-zinc-800 dark:text-zinc-200">illustrative demo</strong>{" "}
          only. It uses synthetic securities and reference-style fields to explain semantic-layer routing concepts. It
          is not a production system, does not connect to live market data or vendor feeds, and must not be used for
          trading, investment decisions, regulatory reporting, risk management, or any operational purpose.
        </p>
        <p>
          Nothing on the Service constitutes financial, legal, tax, accounting, or professional advice. You are solely
          responsible for any decisions you make based on information viewed here.
        </p>
      </LegalSection>

      <LegalSection title="3. License and intellectual property">
        <p>
          All content, code, SQL, designs, text, and data in the Service are owned by {LEGAL_OWNER} and protected by
          copyright and other intellectual-property laws. Your access is a limited, revocable, non-exclusive,
          non-transferable license to <strong className="font-medium text-zinc-800 dark:text-zinc-200">view and evaluate</strong>{" "}
          the Service for portfolio, educational, or hiring-related purposes only.
        </p>
        <p>
          Except for that limited viewing right, no rights are granted. See the{" "}
          <Link href="/legal/copyright" className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            Copyright notice
          </Link>{" "}
          and repository LICENSE for full restrictions.
        </p>
      </LegalSection>

      <LegalSection title="4. Permitted use">
        <p>You may use the Service to:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Explore the demo interactively in a web browser</li>
          <li>Review API behavior for technical assessment</li>
          <li>Discuss the project in hiring, portfolio, or educational contexts</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Prohibited conduct">
        <p>You agree not to:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Use the Service for commercial purposes without a separate written license</li>
          <li>Scrape, crawl, or bulk-download content except at reasonable human browsing volumes</li>
          <li>Attempt to gain unauthorized access, probe vulnerabilities, or disrupt the Service</li>
          <li>Reverse engineer, decompile, or extract source code or logic for reuse elsewhere</li>
          <li>Upload malware, abusive payloads, or unlawful content through any input surface</li>
          <li>Misrepresent affiliation with {LEGAL_OWNER}, BlackRock, or any third party</li>
          <li>Use the Service in violation of applicable law</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. User-submitted data">
        <p>
          The demo may allow you to create or modify hierarchy rules, descriptors, or similar configuration through the
          UI or API. You retain responsibility for anything you submit. You grant {LEGAL_OWNER} a non-exclusive license
          to host, process, and display that content solely to operate the demo. Do not submit confidential, personal, or
          production data.
        </p>
      </LegalSection>

      <LegalSection title="7. Future paid or commercial offerings">
        <p>
          The Service is currently offered without charge for demonstration. {LEGAL_OWNER} may introduce paid tiers,
          subscriptions, enterprise licensing, or other commercial offerings in the future. If that occurs, additional or
          updated terms may apply; continued use after notice may constitute acceptance, or you may stop using the
          Service.
        </p>
        <p>
          For commercial licensing before or after any paid launch, contact{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            {LEGAL_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party trademarks and disclaimers">
        <p>
          Aladdin® is a registered trademark of BlackRock, Inc. The Service is not affiliated with, endorsed by, or
          sponsored by BlackRock or any data vendor. All securities, ISINs, and vendor-style identifiers shown are
          fabricated for demonstration.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of warranties">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. {LEGAL_OWNER} DOES NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, SECURE, OR ACCURATE.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL_OWNER.toUpperCase()} AND ITS SUPPLIERS WILL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS,
          DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF ADVISED
          OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED
          ONE HUNDRED U.S. DOLLARS (US $100) OR THE AMOUNT YOU PAID TO USE THE SERVICE IN THE TWELVE MONTHS BEFORE THE
          CLAIM, WHICHEVER IS GREATER.
        </p>
      </LegalSection>

      <LegalSection title="11. Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless {LEGAL_OWNER} from any claims, damages, losses, and expenses
          (including reasonable attorneys&apos; fees) arising from your misuse of the Service, your submitted content, or
          your violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes and termination">
        <p>
          {LEGAL_OWNER} may modify the Service or these Terms at any time by posting updated Terms with a revised
          &quot;Last updated&quot; date. Material changes may also be noted on the site. {LEGAL_OWNER} may suspend or
          terminate access at any time, with or without notice.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing law">
        <p>
          These Terms are governed by the laws of the Commonwealth of Massachusetts, United States, without regard to
          conflict-of-law principles. You agree that exclusive jurisdiction for disputes relating to these Terms or the
          Service lies in the state or federal courts located in Massachusetts, and you consent to personal jurisdiction
          there.
        </p>
      </LegalSection>

      <LegalSection title="14. General">
        <p>
          If any provision is held unenforceable, the remaining provisions remain in effect. Failure to enforce a
          provision is not a waiver. These Terms are the entire agreement between you and {LEGAL_OWNER} regarding the
          Service.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact">
        <p>
          Questions about these Terms:{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            {LEGAL_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
