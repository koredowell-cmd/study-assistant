import "./globals.css";
import Backdrop from "@/components/Backdrop";
import { PLANS, cedis } from "@/lib/plans";

export const metadata = {
  title: "Study Assistant",
  description:
    "Upload your lecture slides and get study notes and practice questions.",
};

export const viewport = {
  themeColor: "#0a1626",
};

const WHATSAPP_LINK = "https://wa.me/233206583952";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-night text-white">
        <Backdrop />
        {children}

        <footer className="mx-auto w-full max-w-6xl border-t border-white/15 px-5 pb-12 pt-8 text-sm leading-6 text-white/70 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <h2 className="font-serif text-base font-semibold text-white">
                About Study Assistant
              </h2>
              <p className="mt-1">
                Upload your lecture slides as a PDF and get study notes, key
                terms, and practice questions. The notes are written by AI and
                can contain mistakes, so check important details against your
                slides.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-base font-semibold text-white">
                Pricing
              </h2>
              <p className="mt-1">
                Free: 2 uploads a day. {PLANS.week.name}: GH₵
                {cedis(PLANS.week.pesewas)} for {PLANS.week.uploads} uploads over{" "}
                {PLANS.week.days} days. {PLANS.month.name}: GH₵
                {cedis(PLANS.month.pesewas)} for {PLANS.month.uploads} uploads
                over {PLANS.month.days} days. A pass ends when its uploads run
                out or its days end, whichever comes first. You can pay by
                Mobile Money or card through Paystack.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-base font-semibold text-white">
                Support and refunds
              </h2>
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
                  className="font-medium text-gold underline underline-offset-2"
                >
                  0206583952
                </a>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}