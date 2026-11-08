"use client";

import { useRouter } from "next/navigation";
import { SearchSelect } from "@/components/search-select";

// Opens (or starts) the thread with any of your patients who use the app.
export function StartChat({ patients }: { patients: { id: string; name: string }[] }) {
  const router = useRouter();
  if (!patients.length) return <p className="px-1 text-xs text-muted">Patients appear here once they use the app.</p>;
  return (
    <SearchSelect value="" onChange={(e) => e.target.value && router.push(`/dashboard/messages?p=${e.target.value}`)}>
      <option value="" disabled>
        Write to a patient
      </option>
      {patients.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SearchSelect>
  );
}
