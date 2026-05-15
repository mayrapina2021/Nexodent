import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

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
      {/* Corona de la muela (Parte superior) */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <primitive object={material} attach="material" />
      </mesh>
      {/* Cúspides (Detalle superior) */}
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

      {/* Raíces (Parte inferior) */}
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

export default function ToothScene() {
  return (
    <div className="w-full h-[500px] cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
        <pointLight position={[-10, -10, -10]} color="#3b82f6" intensity={1} />
        
        <Environment preset="city" />

        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          <ToothMolar />
        </Float>

        <ContactShadows 
          position={[0, -1.5, 0]} 
          opacity={0.4} 
          scale={10} 
          blur={2} 
          far={4.5} 
        />

        <OrbitControls enableZoom={false} autoRotate={false} />
      </Canvas>
    </div>
  );
}
