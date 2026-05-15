import { useGetMe, useLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, Suspense } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { saveAuthToken } from "@/lib/auth-token";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, Sphere } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

// ── Animated 3D Dental Scene (Original Abstract) ────────────────────────────
function ToothCore() {
  const mesh = useRef<THREE.Mesh>(null);
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (mesh.current) {
      mesh.current.rotation.y = t * 0.5;
      mesh.current.rotation.x = Math.sin(t * 0.3) * 0.2;
    }
    if (ring1.current) ring1.current.rotation.x = t * 0.8;
    if (ring2.current) ring2.current.rotation.z = t * 0.6;
  });

  return (
    <group>
      {/* Core tooth body */}
      <mesh ref={mesh}>
        <capsuleGeometry args={[0.55, 0.9, 6, 32]} />
        <MeshDistortMaterial
          color="#94a3b8"
          speed={3}
          distort={0.25}
          emissive="#64748b"
          emissiveIntensity={0.2}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Orbit ring 1 */}
      <mesh ref={ring1}>
        <torusGeometry args={[1.6, 0.025, 16, 100]} />
        <meshStandardMaterial color="#94a3b8" emissive="#64748b" emissiveIntensity={0.5} />
      </mesh>

      {/* Orbit ring 2 */}
      <mesh ref={ring2} rotation={[1.2, 0, 0]}>
        <torusGeometry args={[1.9, 0.015, 16, 100]} />
        <meshStandardMaterial color="#cbd5e1" emissive="#94a3b8" emissiveIntensity={0.5} />
      </mesh>

      {/* Floating particles */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <Sphere key={i} args={[0.06, 8, 8]} position={[Math.cos(angle) * 2.2, Math.sin(angle * 0.5) * 0.4, Math.sin(angle) * 2.2]}>
            <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={2} />
          </Sphere>
        );
      })}
    </group>
  );
}

function Scene3D() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true }}>
      <color attach="background" args={["#eeeae1"]} />
      <ambientLight intensity={0.7} />
      <pointLight position={[5, 5, 5]} color="#fef3c7" intensity={2} />
      <pointLight position={[-5, -5, -5]} color="#e0f2fe" intensity={1.5} />
      <pointLight position={[0, 5, -5]} color="#dcfce7" intensity={1} />
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.8}>
        <ToothCore />
      </Float>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.4} />
    </Canvas>
  );
}

// ── Form Schema ──────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

// ── Main Login Page ──────────────────────────────────────────────────────────
export default function Login() {
  const { data: user, isLoading: isLoadingUser } = useGetMe();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!isLoadingUser && user) setLocation("/dashboard");
  }, [isLoadingUser, user, setLocation]);

  if (isLoadingUser || user) {
    return <div className="min-h-screen bg-[#eeeae1] flex items-center justify-center"><Skeleton className="w-12 h-12 rounded-full" /></div>;
  }

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data: any) => {
        if (data?.token) saveAuthToken(data.token);
        toast({ title: "✅ Bienvenido al sistema" });
        setLocation("/dashboard");
      },
      onError: () => toast({ variant: "destructive", title: "Credenciales incorrectas" }),
    });
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#eeeae1" }}>
      {/* LEFT — 3D Scene */}
      <div className="hidden lg:flex lg:w-3/5 relative">
        <Suspense fallback={<div className="w-full h-full bg-[#eeeae1]" />}>
          <Scene3D />
        </Suspense>
        {/* Overlay text */}
        <div className="absolute bottom-12 left-12 text-slate-900">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.8 }}>
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
              NEXODENT
            </h1>
            <p className="text-slate-600 mt-2 text-lg font-light tracking-wide">
              Sistema de Gestión Odontológica Inteligente
            </p>
            <div className="mt-6 flex gap-3">
              {["IA Integrada", "100% Digital", "Tiempo Real"].map(tag => (
                <span key={tag} className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-800 bg-blue-100/50">
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT — Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 relative"
        style={{ background: "linear-gradient(135deg, #eeeae1 0%, #e5e0d4 50%, #eeeae1 100%)" }}>
        
        {/* Glow effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-50 rounded-full blur-3xl opacity-50" />
        </div>

        <motion.div
          className="w-full max-w-sm relative z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Logo/Brand */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
              style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", boxShadow: "0 10px 40px rgba(37,99,235,0.2)" }}>
              <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
                <path d="M12 2C8.5 2 7 4 7 6c0 1.5.5 3 1 4.5C8.5 12.5 9 14 9 16c0 2 .5 4 3 4s3-2 3-4c0-2 .5-3.5 1-5 .5-1.5 1-3 1-4.5C17 4 15.5 2 12 2z"/>
              </svg>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nexodent</h2>
            <p className="text-slate-500 text-sm mt-1">Accede a tu panel de control</p>
          </div>

          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label className="text-slate-700 text-sm font-medium">Correo electrónico</Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                {...form.register("email")}
                className="mt-1.5 h-12 text-slate-900 placeholder:text-slate-500 border-slate-300 focus:border-blue-500 focus:ring-blue-500/10 bg-[#f5f1e6]"
              />
              {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
            </div>

            <div>
              <Label className="text-slate-700 text-sm font-medium">Contraseña</Label>
              <Input
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
                className="mt-1.5 h-12 text-slate-900 placeholder:text-slate-500 border-slate-300 focus:border-blue-500 focus:ring-blue-500/10 bg-[#f5f1e6]"
              />
              {form.formState.errors.password && <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-12 font-bold text-white text-base mt-2 rounded-xl border-0"
              style={{
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                boxShadow: "0 4px 20px rgba(29,78,216,0.3)",
              }}
            >
              {loginMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  Ingresando...
                </span>
              ) : "Ingresar al sistema →"}
            </Button>
          </form>

          <p className="text-center text-slate-400 text-xs mt-8">
            © 2025 Nexodent — Sistema Clínico Inteligente
          </p>
        </motion.div>
      </div>
    </div>
  );
}
