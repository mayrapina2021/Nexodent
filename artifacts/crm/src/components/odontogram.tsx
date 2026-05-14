import React, { useState } from "react";
import { cn } from "@/lib/utils";

type Surface = "top" | "bottom" | "left" | "right" | "center";
type Tool = "caries" | "filling" | "missing" | "extract" | "none";

interface ToothData {
  surfaces: Record<Surface, "red" | "blue" | "none">;
  status: "missing" | "extract" | "none";
}

interface ToothProps {
  id: number;
  data: ToothData;
  selectedTool: Tool;
  onUpdate: (id: number, updated: ToothData) => void;
  readonly?: boolean;
}

const Tooth = ({ id, data, selectedTool, onUpdate, readonly }: ToothProps) => {
  const handleClickSurface = (s: Surface) => {
    if (readonly) return;
    
    // Si la herramienta es para el diente completo, delegamos a handleClickWhole
    if (selectedTool === "missing" || selectedTool === "extract") {
      handleClickWhole();
      return;
    }

    const newData = { ...data, surfaces: { ...data.surfaces } };
    
    if (selectedTool === "caries") newData.surfaces[s] = "red";
    else if (selectedTool === "filling") newData.surfaces[s] = "blue";
    else if (selectedTool === "none") newData.surfaces[s] = "none";
    
    onUpdate(id, newData);
  };

  const handleClickWhole = () => {
    if (readonly) return;
    if (selectedTool === "missing") {
      onUpdate(id, { ...data, status: data.status === "missing" ? "none" : "missing" });
    } else if (selectedTool === "extract") {
      onUpdate(id, { ...data, status: data.status === "extract" ? "none" : "extract" });
    }
  };


  const getSurfaceColor = (s: Surface) => {
    const val = data.surfaces[s];
    if (val === "red") return "fill-red-500 stroke-red-600";
    if (val === "blue") return "fill-blue-500 stroke-blue-600";
    return "fill-transparent stroke-border";
  };

  return (
    <div className="flex flex-col items-center gap-1 group">
      <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{id}</span>
      <div className="relative w-10 h-10 cursor-pointer select-none" onClick={handleClickWhole}>
        <svg viewBox="0 0 100 100" className={cn("w-full h-full", data.status !== "none" && "opacity-40")}>
          {/* Top (Vestibular) */}
          <path d="M10,10 L90,10 L75,25 L25,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("top"); }} className={cn("cursor-pointer transition-colors hover:fill-muted", getSurfaceColor("top"))} />
          {/* Bottom (Lingual) */}
          <path d="M10,90 L90,90 L75,75 L25,75 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("bottom"); }} className={cn("cursor-pointer transition-colors hover:fill-muted", getSurfaceColor("bottom"))} />
          {/* Left (Mesial) */}
          <path d="M10,10 L10,90 L25,75 L25,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("left"); }} className={cn("cursor-pointer transition-colors hover:fill-muted", getSurfaceColor("left"))} />
          {/* Right (Distal) */}
          <path d="M90,10 L90,90 L75,75 L75,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("right"); }} className={cn("cursor-pointer transition-colors hover:fill-muted", getSurfaceColor("right"))} />
          {/* Center (Occlusal) */}
          <rect x="25" y="25" width="50" height="50" onClick={(e) => { e.stopPropagation(); handleClickSurface("center"); }} className={cn("cursor-pointer transition-colors hover:fill-muted", getSurfaceColor("center"))} />
        </svg>
        
        {data.status === "missing" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-red-500 rotate-45 absolute" />
            <div className="w-full h-0.5 bg-red-500 -rotate-45 absolute" />
          </div>
        )}
        {data.status === "extract" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-blue-500 rotate-45 absolute" />
          </div>
        )}
      </div>
    </div>
  );
};

export default function Odontogram({ data = {}, onChange, readonly }: any) {
  const [selectedTool, setSelectedTool] = useState<Tool>("caries");

  const upperTeeth = [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28]
  ];
  const lowerTeeth = [
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38]
  ];

  const handleUpdate = (id: number, toothData: ToothData) => {
    if (readonly) return;
    onChange(id, toothData);
  };

  const getToothData = (id: number): ToothData => {
    return data[id] || { surfaces: { top: "none", bottom: "none", left: "none", right: "none", center: "none" }, status: "none" };
  };

  return (
    <div className="p-6 bg-card/40 rounded-2xl border border-border/50 space-y-10 select-none backdrop-blur-sm">
      {/* Herramientas de Marcado */}
      {!readonly && (
        <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-muted/20 rounded-xl border border-border/30">
          <button 
            onClick={() => setSelectedTool("caries")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", selectedTool === "caries" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "hover:bg-muted")}
          >
            🔴 Requerido (Caries)
          </button>
          <button 
            onClick={() => setSelectedTool("filling")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", selectedTool === "filling" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "hover:bg-muted")}
          >
            🔵 Realizado (Obturado)
          </button>
          <button 
            onClick={() => setSelectedTool("missing")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", selectedTool === "missing" ? "bg-gray-800 text-white" : "hover:bg-muted")}
          >
            ❌ Ausente
          </button>
          <button 
            onClick={() => setSelectedTool("extract")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", selectedTool === "extract" ? "bg-amber-600 text-white" : "hover:bg-muted")}
          >
            ⚡ A Extraer
          </button>
          <div className="w-px h-6 bg-border/50 mx-2" />
          <button 
            onClick={() => setSelectedTool("none")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", selectedTool === "none" ? "bg-white text-black" : "hover:bg-muted")}
          >
            🧹 Borrador
          </button>
        </div>
      )}

      <div className="space-y-12">
        {/* Upper Arch */}
        <div className="flex justify-center gap-8">
          {upperTeeth.map((quadrant, qIdx) => (
            <div key={qIdx} className="flex gap-2">
              {quadrant.map(id => (
                <Tooth 
                  key={id} 
                  id={id} 
                  data={getToothData(id)} 
                  selectedTool={selectedTool} 
                  onUpdate={handleUpdate} 
                  readonly={readonly} 
                />
              ))}
            </div>
          ))}
        </div>
        
        {/* Lower Arch */}
        <div className="flex justify-center gap-8">
          {lowerTeeth.map((quadrant, qIdx) => (
            <div key={qIdx} className="flex gap-2">
              {quadrant.map(id => (
                <Tooth 
                  key={id} 
                  id={id} 
                  data={getToothData(id)} 
                  selectedTool={selectedTool} 
                  onUpdate={handleUpdate} 
                  readonly={readonly} 
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center items-center gap-8 text-[10px] text-muted-foreground pt-4 border-t border-border/20">
        <div className="flex items-center gap-2 italic">
          💡 <span className="max-w-xs leading-tight">Selecciona una herramienta y haz clic en las superficies de los dientes para marcar.</span>
        </div>
      </div>
    </div>
  );
}
