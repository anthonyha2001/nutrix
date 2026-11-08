import Link from "next/link";
import { Logo } from "@/components/ui";
import { PrintButton } from "./print-button";

// A4-friendly document frame for invoices and receipts.
export function PrintDocument({
  kind,
  number,
  date,
  practice,
  patient,
  rows,
  total,
  footer,
  back,
}: {
  kind: string;
  number: string;
  date: string;
  practice: string;
  patient: { name: string; phone: string | null; email: string | null };
  rows: { label: string; value: string }[];
  total: { label: string; value: string };
  footer?: React.ReactNode;
  back: string;
}) {
  return (
    <main className="flex flex-1 justify-center bg-canvas px-4 py-8 print:bg-white print:p-0">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex justify-between print:hidden">
          <Link href={back} className="text-sm text-muted hover:text-ink">
            Back
          </Link>
          <PrintButton />
        </div>
        <article className="rounded-2xl border border-line bg-surface p-10 print:rounded-none print:border-0 print:p-0">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
            <div>
              <p className="text-xl font-semibold">{practice}</p>
              <p className="mt-1 text-sm text-muted">{kind}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{number}</p>
              <p className="text-muted">{date}</p>
            </div>
          </header>
          <section className="py-6 text-sm">
            <p className="text-xs tracking-wide text-muted uppercase">Billed to</p>
            <p className="mt-1 font-medium">{patient.name}</p>
            {patient.phone && <p className="text-muted">{patient.phone}</p>}
            {patient.email && <p className="text-muted">{patient.email}</p>}
          </section>
          <dl className="divide-y divide-line border-y border-line text-sm">
            {rows.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 py-3">
                <dt className="text-muted">{r.label}</dt>
                <dd className="text-right">{r.value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-between py-4 text-lg font-semibold">
            <span>{total.label}</span>
            <span className="tabular-nums">{total.value}</span>
          </div>
          {footer && <div className="text-sm text-muted">{footer}</div>}
          <footer className="mt-10 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
            <span>Thank you.</span>
            <Logo className="text-xs opacity-70" />
          </footer>
        </article>
      </div>
    </main>
  );
}
