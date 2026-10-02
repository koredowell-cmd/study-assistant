import "./globals.css";
import { PLANS, cedis } from "@/lib/plans";

export const metadata = {
  title: "Study Assistant",
  description:
    "Upload your lecture slides and get study notes and practice questions.",
};

const WHATSAPP_LINK = "https://wa.me/233206583952";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}

        <footer className="mx-auto max-w-2xl px-6 pb-10 pt-6 text-center text-xs leading-relaxed text-gray-500">
          <p className="font-semibold text-gray-700">About Study Assistant</p>
          <p className="mt-1">
            Upload your lecture slides (PDF) and get study notes, key terms, and
            practice questions. Notes are written by AI and can contain mistakes,
            so always check important details against your slides.
          </p>

          <p className="mt-4 font-semibold text-gray-700">Pricing</p>
          <p className="mt-1">
            Free: 2 uploads per day. {PLANS.week.name}: GH₵{cedis(PLANS.week.pesewas)}{" "}
            for {PLANS.week.uploads} uploads over {PLANS.week.days} days.{" "}
            {PLANS.month.name}: GH₵{cedis(PLANS.month.pesewas)} for{" "}
            {PLANS.month.uploads} uploads over {PLANS.month.days} days. A pass ends
            when its uploads run out or its days end, whichever comes first.
            Payments are by Mobile Money or card.
          </p>

          <p className="mt-4 font-semibold text-gray-700">Support and refunds</p>
          <p className="mt-1">
            If you pay and your pass doesn&apos;t activate, contact us and
            we&apos;ll fix it or refund you within 48 hours.
          </p>
          <p className="mt-1">
            WhatsApp:{" "}
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              0206583952
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}