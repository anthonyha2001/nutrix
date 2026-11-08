import { Suspense } from "react";

// Session reads must sit inside a Suspense boundary (cacheComponents).
export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
