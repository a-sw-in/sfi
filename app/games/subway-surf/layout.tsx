import type { ReactNode } from "react";

export default function SubwayLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "#240808",
        minHeight: "100vh",
      }}
    >
      {children}
    </div>
  );
}
