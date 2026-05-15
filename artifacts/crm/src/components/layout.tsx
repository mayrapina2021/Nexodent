import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { clearAuthToken } from "@/lib/auth-token";
import {
  LayoutDashboard,
  Users,
  Calendar as CalendarIcon,
  MessageSquare,
  Smartphone,
  Settings as SettingsIcon,
  Workflow,
  LogOut,
  Brain,
  MoreHorizontal,
  X,
  FileText,
  Package,
  Syringe,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, Suspense } from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Skeleton } from "./ui/skeleton";
import ClinicLogo from "./clinic-logo";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere } from "@react-three/drei";
import * as THREE from "three";

// ── 3D Animated Background ────────────────────────────────────────────────
function ToothFloat() {
  const mesh = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (mesh.current) {
      mesh.current.rotation.y = t * 0.25;
      mesh.current.rotation.x = Math.sin(t * 0.2) * 0.15;
      mesh.current.position.y = Math.sin(t * 0.5) * 0.3;
    }
    if (ring1.current) ring1.current.rotation.x = t * 0.5;
    if (ring2.current) ring2.current.rotation.z = t * 0.4;
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Main tooth body */}
      <mesh ref={mesh}>
        <capsuleGeometry args={[0.9, 1.4, 8, 32]} />
        <meshStandardMaterial
          color="#1e40af"
          emissive="#3b82f6"
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0.95}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Crown bumps (cúspides) */}
      {[[-0.4, 0.9, 0.2], [0.4, 0.9, 0.2], [0, 0.95, -0.3], [-0.35, 0.88, -0.2], [0.35, 0.88, -0.2]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#2563eb" emissive="#60a5fa" emissiveIntensity={0.5} roughness={0.05} metalness={0.9} transparent opacity={0.9} />
        </mesh>
      ))}

      {/* Orbit rings */}
      <mesh ref={ring1}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={1.5} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring2} rotation={[1.0, 0.3, 0]}>
        <torusGeometry args={[3.2, 0.015, 16, 100]} />
        <meshStandardMaterial color="#818cf8" emissive="#6366f1" emissiveIntensity={1.5} transparent opacity={0.4} />
      </mesh>

      {/* Floating particles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const r = 2.2 + Math.random() * 1.2;
        return (
          <Sphere key={i} args={[0.04 + Math.random() * 0.06, 8, 8]}
            position={[Math.cos(angle) * r, (Math.random() - 0.5) * 2, Math.sin(angle) * r]}>
            <meshStandardMaterial color="#bfdbfe" emissive="#38bdf8" emissiveIntensity={3} />
          </Sphere>
        );
      })}
    </group>
  );
}

function AnimatedBg() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 50 }} className="pointer-events-none">
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} color="#3b82f6" intensity={5} />
      <pointLight position={[-10, -5, -10]} color="#6366f1" intensity={3} />
      <pointLight position={[0, -10, 5]} color="#0ea5e9" intensity={2} />
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
        <ToothFloat />
      </Float>
    </Canvas>
  );
}

// ── Navigation config ────────────────────────────────────────────────────────
const mainNav = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/patients", label: "Pacientes", icon: Users },
  { href: "/appointments", label: "Agenda", icon: CalendarIcon },
  { href: "/quotations", label: "Presupuestos", icon: FileText },
  { href: "/treatments", label: "Tratamientos", icon: Syringe },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/conversations", label: "Chat", icon: MessageSquare },
];

const moreNav = [
  { href: "/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/automations", label: "Automatizaciones", icon: Workflow },
  { href: "/ai-training", label: "Entrenar IA", icon: Brain },
  { href: "/settings", label: "Configuración", icon: SettingsIcon },
];

const allNav = [...mainNav, ...moreNav];

// ── Layout ───────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const logout = useLogout();
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { clearAuthToken(); setLocation("/login"); }
  }, [isLoading, user, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#030712" }}>
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
    );
  }

  const handleLogout = () => {
    clearAuthToken();
    setLocation("/login");
    logout.mutate(undefined, {}).catch(() => {});
  };

  const isMoreActive = moreNav.some(item => location.startsWith(item.href));

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative" style={{ background: "#030712" }}>

      {/* ── Global 3D Background ──────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Suspense fallback={null}>
          <AnimatedBg />
        </Suspense>
        {/* Dark overlay so content stays readable */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(3,7,18,0.55) 0%, rgba(10,15,40,0.45) 100%)" }} />
      </div>

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col h-screen sticky top-0 z-20"
        style={{
          width: "256px",
          background: "rgba(3,7,18,0.80)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(59,130,246,0.15)",
          boxShadow: "4px 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo */}
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid rgba(59,130,246,0.1)" }}>
          <ClinicLogo size="md" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {allNav.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                    isActive
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  )}
                  style={isActive ? {
                    background: "linear-gradient(135deg, rgba(37,99,235,0.5), rgba(99,102,241,0.3))",
                    boxShadow: "0 0 20px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
                    border: "1px solid rgba(59,130,246,0.3)",
                  } : {
                    border: "1px solid transparent",
                  }}
                >
                  <item.icon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-sky-400" : "")} style={{ width: "18px", height: "18px" }} />
                  {item.label}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-4 mt-auto" style={{ borderTop: "1px solid rgba(59,130,246,0.1)" }}>
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Avatar className="h-9 w-9 shrink-0" style={{ border: "2px solid rgba(59,130,246,0.4)" }}>
              <AvatarFallback style={{ background: "linear-gradient(135deg, #1d4ed8, #6366f1)", color: "white", fontSize: "12px" }}>
                {(user.name ?? "Ad").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate">{user.name}</span>
              <span className="text-xs text-slate-500 truncate">{user.email}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-400 transition-all hover:text-red-300 cursor-pointer"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Header ─────────────────────────────────────────────── */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
        style={{ background: "rgba(3,7,18,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(59,130,246,0.15)" }}
      >
        <ClinicLogo size="sm" />
        <Avatar className="h-8 w-8" style={{ border: "2px solid rgba(59,130,246,0.4)" }}>
          <AvatarFallback style={{ background: "linear-gradient(135deg, #1d4ed8, #6366f1)", color: "white", fontSize: "11px" }}>
            {(user.name ?? "Ad").substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "rgba(3,7,18,0.92)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(59,130,246,0.15)" }}
      >
        <div className="flex items-stretch h-16">
          {mainNav.slice(0, 5).map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <span className={cn("flex flex-col items-center justify-center gap-0.5 h-full w-full transition-colors", isActive ? "text-sky-400" : "text-slate-500")}>
                  <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                </span>
              </Link>
            );
          })}
          <button
            className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors", isMoreActive || moreOpen ? "text-sky-400" : "text-slate-500")}
            onClick={() => setMoreOpen(v => !v)}
          >
            {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile "Más" panel ────────────────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="relative rounded-t-2xl pt-3 pb-8 px-4 z-10 shadow-2xl"
            style={{ background: "rgba(3,7,18,0.95)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
            <div className="space-y-1 mb-4">
              {moreNav.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}>
                    <span className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                      isActive ? "text-sky-400" : "text-slate-300 hover:text-white hover:bg-white/5")}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9" style={{ border: "2px solid rgba(59,130,246,0.4)" }}>
                  <AvatarFallback style={{ background: "linear-gradient(135deg,#1d4ed8,#6366f1)", color: "white", fontSize: "12px" }}>
                    {(user.name ?? "Ad").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
