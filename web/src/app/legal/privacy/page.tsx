import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";
import { LEGAL_EMAIL, LEGAL_OWNER, SITE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy practices for the semantic layer portfolio demonstration website.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy">
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        This Privacy Policy describes how {LEGAL_OWNER} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) handles
        information when you use the {SITE_NAME} portfolio demonstration website and API (the &quot;Service&quot;).
      </p>

      <LegalSection title="1. Summary">
        <p>
          The Service is a small technical demo, not a consumer product. We collect minimal information needed to
          operate and secure the site. We do not sell personal information. We do not use third-party advertising or
          analytics trackers at this time.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <p>
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">Information you provide.</strong> If you use
          demo features that create or edit hierarchy rules, descriptors, or similar configuration, that content is
          stored in the demo database to make the experience work. Do not submit real personal data, client data, or
          production securities information.
        </p>
        <p>
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">Automatic technical data.</strong> Like most
          websites, our hosting infrastructure may log standard technical information such as IP address, browser type,
          request timestamps, pages or API paths accessed, and error diagnostics. We use this for security, abuse
          prevention, and reliability.
        </p>
        <p>
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">Cookies and local storage.</strong> The
          Service does not currently set advertising cookies or cross-site tracking technologies. Essential cookies or
          similar technologies may be used by the hosting platform for security or session continuity. If we add optional
          analytics or authentication later, this policy will be updated.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p>We use collected information to:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Operate, maintain, and improve the demo</li>
          <li>Respond to support or licensing inquiries you initiate</li>
          <li>Detect, prevent, and address abuse, fraud, or security issues</li>
          <li>Comply with legal obligations</li>
        </ul>
        <p>We do not use your information for automated decision-making that produces legal or similarly significant effects.</p>
      </LegalSection>

      <LegalSection title="4. Legal bases (EEA/UK users)">
        <p>
          Where applicable, we process personal data on grounds of legitimate interests (operating and securing a
          portfolio demo), performance of a request you make (e.g., contacting us), and compliance with law. You may
          have rights to access, correct, delete, restrict, or object to certain processing, and to lodge a complaint
          with a supervisory authority.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing and disclosure">
        <p>
          We do not sell or rent personal information. We may share limited data with infrastructure providers that host
          the Service (for example, a cloud or platform host) under contractual safeguards, or when required by law,
          court order, or to protect rights, safety, and security.
        </p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          Demo configuration and synthetic seed data may be reset periodically. Server logs are retained only as long
          as reasonably necessary for security and operations, then deleted or aggregated. If you contact us by email,
          we retain correspondence as needed to handle your inquiry.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We use reasonable administrative, technical, and organizational measures appropriate to a demonstration site.
          No method of transmission or storage is completely secure; use the Service accordingly and do not submit
          sensitive information.
        </p>
      </LegalSection>

      <LegalSection title="8. Children">
        <p>
          The Service is intended for professional and technical audiences. It is not directed to children under 13 (or
          16 where applicable), and we do not knowingly collect their personal information.
        </p>
      </LegalSection>

      <LegalSection title="9. International transfers">
        <p>
          If you access the Service from outside the United States, your information may be processed in the United
          States or other locations where our providers operate. We take steps consistent with applicable law for
          cross-border transfers where required.
        </p>
      </LegalSection>

      <LegalSection title="10. Future monetization">
        <p>
          If we later introduce accounts, payments, or marketing communications, we will update this policy to describe
          any additional categories of data collected, how payment processors are used, and your choices. Paid features
          will be governed by our{" "}
          <Link href="/legal/terms" className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            Terms of Service
          </Link>{" "}
          as well.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Privacy Policy from time to time. The &quot;Last updated&quot; date at the top will change
          when we do. Continued use after an update means you accept the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Privacy questions or requests:{" "}
          <a href={`mailto:${LEGAL_EMAIL}`} className="font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
            {LEGAL_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
