import React, { useState } from "react";
import { cn } from "@/lib/utils";

type Surface = "top" | "bottom" | "left" | "right" | "center";
type Status = "missing" | "extract" | "fracture" | "prosthesis" | "endodontics" | "none";

interface ToothData {
  surfaces: Record<Surface, "red" | "blue" | "none">;
  status: Status;
}

interface ToothProps {
  id: number;
  data: ToothData;
  selectedTool: string;
  onUpdate: (id: number, updated: ToothData) => void;
  readonly?: boolean;
}

const Tooth = ({ id, data, selectedTool, onUpdate, readonly }: ToothProps) => {
  const handleClickSurface = (s: Surface) => {
    if (readonly) return;
    
    // Tools that apply to the whole tooth
    const wholeToothTools = ["missing", "extract", "fracture", "prosthesis", "endodontics"];
    if (wholeToothTools.includes(selectedTool)) {
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
    const currentStatus = data.status === selectedTool ? "none" : (selectedTool as Status);
    onUpdate(id, { ...data, status: currentStatus });
  };

  const getSurfaceColor = (s: Surface) => {
    const val = data.surfaces[s];
    if (val === "red") return "fill-red-500/80 stroke-red-600";
    if (val === "blue") return "fill-blue-500/80 stroke-blue-600";
    return "fill-transparent stroke-slate-300";
  };

  return (
    <div className="flex flex-col items-center gap-1 group">
      <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">{id}</span>
      <div className="relative w-12 h-12 cursor-pointer select-none" onClick={handleClickWhole}>
        <svg viewBox="0 0 100 100" className={cn("w-full h-full transform transition-transform hover:scale-105", data.status !== "none" && data.status !== "fracture" && "opacity-40")}>
          {/* Top (Vestibular) */}
          <path d="M10,10 L90,10 L75,25 L25,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("top"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-100", getSurfaceColor("top"))} />
          {/* Bottom (Lingual) */}
          <path d="M10,90 L90,90 L75,75 L25,75 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("bottom"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-100", getSurfaceColor("bottom"))} />
          {/* Left (Mesial) */}
          <path d="M10,10 L10,90 L25,75 L25,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("left"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-100", getSurfaceColor("left"))} />
          {/* Right (Distal) */}
          <path d="M90,10 L90,90 L75,75 L75,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("right"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-100", getSurfaceColor("right"))} />
          {/* Center (Occlusal) */}
          <rect x="25" y="25" width="50" height="50" onClick={(e) => { e.stopPropagation(); handleClickSurface("center"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-100", getSurfaceColor("center"))} />
        </svg>
        
        {data.status === "missing" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <svg viewBox="0 0 100 100" className="w-full h-full text-red-600">
                <line x1="10" y1="10" x2="90" y2="90" stroke="currentColor" strokeWidth="4" />
                <line x1="90" y1="10" x2="10" y2="90" stroke="currentColor" strokeWidth="4" />
             </svg>
          </div>
        )}
        {data.status === "extract" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <svg viewBox="0 0 100 100" className="w-full h-full text-blue-600">
                <line x1="10" y1="10" x2="90" y2="90" stroke="currentColor" strokeWidth="4" />
             </svg>
          </div>
        )}
        {data.status === "fracture" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-full h-0.5 bg-red-600 rotate-[30deg]" />
          </div>
        )}
      </div>
    </div>
  );
};

export default function Odontogram({ data = {}, onChange, readonly }: any) {
  const [activeTab, setActiveTab] = useState("permanente");
  const [selectedTool, setSelectedTool] = useState("caries");

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
    <div className="p-8 bg-white rounded-xl shadow-2xl border border-slate-200 space-y-12 select-none overflow-x-auto min-w-[800px]">
      {/* Tabs Superiores */}
      <div className="flex bg-slate-100 p-1 rounded-lg w-fit mx-auto shadow-inner">
        {["permanente", "temporal", "mixta"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2 rounded-md text-xs font-bold uppercase transition-all",
              activeTab === tab ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-200"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Odontograma Visual */}
      <div className="space-y-16 py-4">
        <div className="flex justify-center gap-12 border-b border-slate-100 pb-12">
          {upperTeeth.map((quadrant, qIdx) => (
            <div key={qIdx} className="flex gap-3">
              {quadrant.map(id => (
                <Tooth key={id} id={id} data={getToothData(id)} selectedTool={selectedTool} onUpdate={handleUpdate} readonly={readonly} />
              ))}
            </div>
          ))}
        </div>
        
        <div className="flex justify-center gap-12">
          {lowerTeeth.map((quadrant, qIdx) => (
            <div key={qIdx} className="flex gap-3">
              {quadrant.map(id => (
                <Tooth key={id} id={id} data={getToothData(id)} selectedTool={selectedTool} onUpdate={handleUpdate} readonly={readonly} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Panel de Herramientas Estilo Profesional */}
      {!readonly && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6">
          <div className="flex gap-1 bg-slate-200 p-1 rounded-xl w-fit">
             <button className={cn("px-8 py-2 rounded-lg text-xs font-bold uppercase", selectedTool === "caries" ? "bg-indigo-600 text-white" : "text-slate-600")}>Requerido</button>
             <button className={cn("px-8 py-2 rounded-lg text-xs font-bold uppercase", selectedTool === "filling" ? "bg-indigo-600 text-white" : "text-slate-600")}>Realizado</button>
             <button className={cn("px-8 py-2 rounded-lg text-xs font-bold uppercase", selectedTool === "none" ? "bg-indigo-600 text-white" : "text-slate-600")}>Características</button>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {[
              { id: "caries", label: "Caries 🔴", type: "surface" },
              { id: "filling", label: "Obturado 🔵", type: "surface" },
              { id: "missing", label: "Ausente /", type: "whole" },
              { id: "extract", label: "A Extraer X", type: "whole" },
              { id: "fracture", label: "Fractura ~", type: "whole" },
              { id: "prosthesis", label: "Prótesis 🦷", type: "whole" },
              { id: "endodontics", label: "Endodoncia 📍", type: "whole" },
              { id: "none", label: "Limpiar 🧹", type: "none" },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={cn(
                  "p-3 rounded-xl text-[11px] font-bold border transition-all flex flex-col items-center justify-center gap-1",
                  selectedTool === tool.id 
                    ? "bg-white border-indigo-500 text-indigo-700 shadow-lg ring-2 ring-indigo-500/20" 
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
