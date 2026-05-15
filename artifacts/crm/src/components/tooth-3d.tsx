import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshWobbleMaterial, OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";

function ToothModel() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Animación suave de rotación
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.2;
    }
  });

  return (
    <mesh ref={meshRef} scale={1.5}>
      {/* 
        Simulamos una muela con una geometría de cápsula distorsionada 
        hasta que podamos cargar un modelo .glb específico. 
        Esto crea un efecto "orgánico" y tecnológico muy premium.
      */}
      <capsuleGeometry args={[0.5, 0.7, 4, 32]} />
      <MeshDistortMaterial 
        color="#88ccff" 
        speed={2} 
        distort={0.3} 
        radius={1} 
        emissive="#0055ff"
        emissiveIntensity={0.5}
        roughness={0.1}
        metalness={0.8}
      />
    </mesh>
  );
}

export default function ToothScene() {
  return (
    <div className="w-full h-[400px] cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} color="blue" />
        
        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
          <ToothModel />
        </Float>

        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
}
