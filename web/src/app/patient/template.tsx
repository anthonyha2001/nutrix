// Every patient screen eases in when opened (a template re-mounts on each navigation).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
