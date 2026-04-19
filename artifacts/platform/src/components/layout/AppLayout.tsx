import { Sidebar } from "./Sidebar";

export function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex h-screen overflow-hidden" dir="ltr" style={{
      background: "linear-gradient(135deg, #060410 0%, #070612 50%, #060310 100%)",
      position: "relative",
    }}>
      {/* Ambient glow decorations */}
      <div style={{
        position: "fixed", top: -120, left: -120,
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: -80, right: 200,
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(6,182,212,0.05) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ position: "relative", zIndex: 1 }}>
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
