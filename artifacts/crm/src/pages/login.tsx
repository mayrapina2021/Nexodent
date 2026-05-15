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
import { Float, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Scene3D() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
        <pointLight position={[-10, -10, -10]} color="#3b82f6" intensity={1} />
        <Environment preset="city" />
        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <ToothMolar />
        </Float>
        <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2} far={4.5} />
        <OrbitControls enableZoom={false} autoRotate={false} />
      </Canvas>
    </div>
  );
}

function ToothMolar() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005;
      groupRef.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.1;
    }
  });

  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.1,
    metalness: 0.2,
    emissive: "#ffffff",
    emissiveIntensity: 0.05,
  });

  return (
    <group ref={groupRef} scale={1.8}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[0.2, 0.7, 0.2]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[-0.2, 0.7, 0.2]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[0.2, 0.7, -0.2]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[-0.2, 0.7, -0.2]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[0.2, -0.1, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.25, 0.1, 0.8, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[-0.2, -0.1, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.25, 0.1, 0.8, 16]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
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
    return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Skeleton className="w-12 h-12 rounded-full" /></div>;
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
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#020617" }}>
      {/* LEFT — 3D Scene */}
      <div className="hidden lg:flex lg:w-3/5 relative">
        <Suspense fallback={<div className="w-full h-full bg-[#020617]" />}>
          <Scene3D />
        </Suspense>
        {/* Overlay text */}
        <div className="absolute bottom-12 left-12 text-white">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.8 }}>
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              NEXODENT
            </h1>
            <p className="text-slate-400 mt-2 text-lg font-light tracking-wide">
              Sistema de Gestión Odontológica Inteligente
            </p>
            <div className="mt-6 flex gap-3">
              {["IA Integrada", "100% Digital", "Tiempo Real"].map(tag => (
                <span key={tag} className="text-xs px-3 py-1 rounded-full border border-sky-500/30 text-sky-400 bg-sky-500/10">
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT — Login Form */}
      <div className="w-full lg:w-2/5 flex items-center justify-center p-8 relative"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}>
        
        {/* Glow effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-sky-600/15 rounded-full blur-3xl" />
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
              style={{ background: "linear-gradient(135deg, #1d4ed8, #6366f1)", boxShadow: "0 0 40px rgba(99,102,241,0.5)" }}>
              <svg viewBox="0 0 24 24" fill="white" className="w-10 h-10">
                <path d="M12 2C8.5 2 7 4 7 6c0 1.5.5 3 1 4.5C8.5 12.5 9 14 9 16c0 2 .5 4 3 4s3-2 3-4c0-2 .5-3.5 1-5 .5-1.5 1-3 1-4.5C17 4 15.5 2 12 2z"/>
              </svg>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Nexodent</h2>
            <p className="text-slate-400 text-sm mt-1">Accede a tu panel de control</p>
          </div>

          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label className="text-slate-300 text-sm font-medium">Correo electrónico</Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                {...form.register("email")}
                className="mt-1.5 h-12 text-white placeholder:text-slate-500 border-slate-600/50 focus:border-indigo-500 focus:ring-indigo-500/20"
                style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)" }}
              />
              {form.formState.errors.email && <p className="text-red-400 text-xs mt-1">{form.formState.errors.email.message}</p>}
            </div>

            <div>
              <Label className="text-slate-300 text-sm font-medium">Contraseña</Label>
              <Input
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
                className="mt-1.5 h-12 text-white placeholder:text-slate-500 border-slate-600/50 focus:border-indigo-500 focus:ring-indigo-500/20"
                style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)" }}
              />
              {form.formState.errors.password && <p className="text-red-400 text-xs mt-1">{form.formState.errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-12 font-bold text-white text-base mt-2 rounded-xl border-0"
              style={{
                background: "linear-gradient(135deg, #2563eb, #6366f1)",
                boxShadow: "0 4px 30px rgba(99,102,241,0.4)",
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

          <p className="text-center text-slate-600 text-xs mt-8">
            © 2025 Nexodent — Sistema Clínico Inteligente
          </p>
        </motion.div>
      </div>
    </div>
  );
}
