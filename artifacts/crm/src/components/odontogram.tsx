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
    if (val === "red") return "fill-red-500 stroke-red-700";
    if (val === "blue") return "fill-blue-500 stroke-blue-700";
    return "fill-transparent stroke-slate-400";
  };

  return (
    <div className="flex flex-col items-center gap-0.5 group shrink-0">
      <span className="text-[9px] font-black text-slate-600 group-hover:text-indigo-600 transition-colors">{id}</span>
      <div className="relative w-9 h-9 cursor-pointer select-none" onClick={handleClickWhole}>
        <svg viewBox="0 0 100 100" className={cn("w-full h-full transition-transform hover:scale-110", (data.status === "missing" || data.status === "extract") && "opacity-40")}>
          {/* Aumentamos strokeWidth para legibilidad */}

          <g strokeWidth="3">
            <path d="M10,10 L90,10 L75,25 L25,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("top"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-200", getSurfaceColor("top"))} />
            <path d="M10,90 L90,90 L75,75 L25,75 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("bottom"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-200", getSurfaceColor("bottom"))} />
            <path d="M10,10 L10,90 L25,75 L25,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("left"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-200", getSurfaceColor("left"))} />
            <path d="M90,10 L90,90 L75,75 L75,25 Z" onClick={(e) => { e.stopPropagation(); handleClickSurface("right"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-200", getSurfaceColor("right"))} />
            <rect x="25" y="25" width="50" height="50" onClick={(e) => { e.stopPropagation(); handleClickSurface("center"); }} className={cn("cursor-pointer transition-colors hover:fill-slate-200", getSurfaceColor("center"))} />
          </g>
        </svg>
        
        {data.status === "missing" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-1">
             <svg viewBox="0 0 100 100" className="w-full h-full text-red-600">
                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="8" />
                <line x1="100" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="8" />
             </svg>
          </div>
        )}
        {data.status === "extract" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-1">
             <svg viewBox="0 0 100 100" className="w-full h-full text-blue-600">
                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="8" />
             </svg>
          </div>
        )}
        {data.status === "fracture" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-full h-1 bg-red-600 rotate-[20deg]" />
          </div>
        )}
        {data.status === "prosthesis" && (
          <div className="absolute inset-0 border-4 border-indigo-500/50 rounded-sm pointer-events-none" />
        )}
        {data.status === "endodontics" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="w-1 h-full bg-red-600/80" />
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
    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      {/* Header Compacto */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
          {["permanente", "temporal", "mixta"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all",
                activeTab === tab ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        {!readonly && (
           <div className="flex gap-1">
             {["caries", "filling", "none"].map((t) => (
               <button 
                 key={t}
                 onClick={() => setSelectedTool(t)}
                 className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-bold border transition-all",
                    selectedTool === t ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white text-slate-500"
                 )}
               >
                 {t === "caries" ? "REQUERIDO" : t === "filling" ? "REALIZADO" : "CARACTERÍSTICAS"}
               </button>
             ))}
           </div>
        )}
      </div>

      {/* Area del Odontograma - Con scroll controlado */}
      <div className="p-4 overflow-x-auto overflow-y-hidden scrollbar-hide">
        <div className="flex flex-col gap-8 min-w-fit mx-auto">
          {/* Upper Arch */}
          <div className="flex justify-center gap-4 border-b border-slate-50 pb-8">
            <div className="flex gap-1.5">
              {upperTeeth[0].map(id => (
                <Tooth key={id} id={id} data={getToothData(id)} selectedTool={selectedTool} onUpdate={handleUpdate} readonly={readonly} />
              ))}
            </div>
            <div className="w-px bg-slate-200 self-stretch" />
            <div className="flex gap-1.5">
              {upperTeeth[1].map(id => (
                <Tooth key={id} id={id} data={getToothData(id)} selectedTool={selectedTool} onUpdate={handleUpdate} readonly={readonly} />
              ))}
            </div>
          </div>
          
          {/* Lower Arch */}
          <div className="flex justify-center gap-4">
            <div className="flex gap-1.5">
              {lowerTeeth[0].map(id => (
                <Tooth key={id} id={id} data={getToothData(id)} selectedTool={selectedTool} onUpdate={handleUpdate} readonly={readonly} />
              ))}
            </div>
            <div className="w-px bg-slate-200 self-stretch" />
            <div className="flex gap-1.5">
              {lowerTeeth[1].map(id => (
                <Tooth key={id} id={id} data={getToothData(id)} selectedTool={selectedTool} onUpdate={handleUpdate} readonly={readonly} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Herramientas Compacta */}
      {!readonly && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-4 md:grid-cols-8 gap-2">
          {[
            { id: "caries", label: "Caries", symbol: "🔴" },
            { id: "filling", label: "Obturado", symbol: "🔵" },
            { id: "missing", label: "Ausente", symbol: "❌" },
            { id: "extract", label: "Extracción", symbol: "⚡" },
            { id: "fracture", label: "Fractura", symbol: "〰️" },
            { id: "prosthesis", label: "Prótesis", symbol: "🦷" },
            { id: "endodontics", label: "Endo", symbol: "📍" },
            { id: "none", label: "Borrar", symbol: "🧹" },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={cn(
                "flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all gap-0.5",
                selectedTool === tool.id 
                  ? "bg-white border-indigo-500 text-indigo-700 shadow-sm" 
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <span className="text-xs">{tool.symbol}</span>
              <span className="text-[8px] font-bold uppercase">{tool.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
