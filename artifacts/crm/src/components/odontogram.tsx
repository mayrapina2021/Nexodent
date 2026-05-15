import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// FDI Notation: 11-18, 21-28, 31-38, 41-48 (Adults)
const ADULT_TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export type ToothStatus = "healthy" | "cavity" | "filling" | "missing" | "crown" | "extraction" | "endodontics";

export interface ToothData {
  status: ToothStatus;
  surfaces: string[]; // 'top', 'bottom', 'left', 'right', 'center'
}

interface OdontogramProps {
  data: Record<string, ToothData>;
  onChange: (toothId: string, data: ToothData) => void;
  readOnly?: boolean;
}

const STATUS_CONFIG: Record<ToothStatus, { label: string, color: string, icon?: string }> = {
  healthy: { label: "Sano", color: "bg-slate-200 dark:bg-slate-700" },
  cavity: { label: "Caries", color: "bg-red-500" },
  filling: { label: "Obturación", color: "bg-blue-500" },
  missing: { label: "Ausente", color: "bg-slate-400" },
  crown: { label: "Corona", color: "bg-yellow-500" },
  extraction: { label: "Exodoncia", color: "bg-purple-600" },
  endodontics: { label: "Endodoncia", color: "bg-green-500" },
};

const Tooth = ({ id, data, onUpdate, readOnly, activeStatus }: { id: number, data?: ToothData, onUpdate: (d: ToothData) => void, readOnly?: boolean, activeStatus: ToothStatus }) => {
  const currentData = data || { status: "healthy", surfaces: [] };

  const handleToothClick = () => {
    if (readOnly) return;
    // Si el estado activo es el mismo que ya tiene, lo reseteamos a sano (Toggle)
    if (activeStatus === currentData.status) {
      onUpdate({ status: "healthy", surfaces: [] });
    } else {
      onUpdate({ ...currentData, status: activeStatus });
    }
  };

  const handleSurfaceClick = (e: React.MouseEvent, surface: string) => {
    e.stopPropagation();
    if (readOnly) return;
    
    let newSurfaces = [...currentData.surfaces];
    const isRemoving = newSurfaces.includes(surface);
    
    if (isRemoving) {
      newSurfaces = newSurfaces.filter(s => s !== surface);
    } else {
      newSurfaces.push(surface);
    }
    
    // Si quitamos la última superficie y el diente no tiene un estado global (como ausente), lo ponemos sano
    const shouldResetStatus = isRemoving && newSurfaces.length === 0 && (currentData.status === "cavity" || currentData.status === "filling");

    onUpdate({ 
      status: shouldResetStatus ? "healthy" : (activeStatus === "healthy" ? currentData.status : activeStatus), 
      surfaces: newSurfaces 
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-1 group">
            <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">{id}</span>
            <div 
              onClick={handleToothClick}
              className={cn(
                "relative w-10 h-10 border-2 border-border rounded-md transition-all cursor-pointer hover:border-primary/50",
                currentData.status === "missing" && "opacity-40 grayscale"
              )}
            >
              {/* Surfaces Layout */}
              <div 
                onClick={(e) => handleSurfaceClick(e, "top")}
                className={cn("absolute top-0 left-0 right-0 h-1/4 border-b border-border/30", currentData.surfaces.includes("top") ? STATUS_CONFIG[currentData.status].color : "bg-transparent")} 
              />
              <div 
                onClick={(e) => handleSurfaceClick(e, "bottom")}
                className={cn("absolute bottom-0 left-0 right-0 h-1/4 border-t border-border/30", currentData.surfaces.includes("bottom") ? STATUS_CONFIG[currentData.status].color : "bg-transparent")} 
              />
              <div 
                onClick={(e) => handleSurfaceClick(e, "left")}
                className={cn("absolute top-0 left-0 bottom-0 w-1/4 border-r border-border/30", currentData.surfaces.includes("left") ? STATUS_CONFIG[currentData.status].color : "bg-transparent")} 
              />
              <div 
                onClick={(e) => handleSurfaceClick(e, "right")}
                className={cn("absolute top-0 right-0 bottom-0 w-1/4 border-l border-border/30", currentData.surfaces.includes("right") ? STATUS_CONFIG[currentData.status].color : "bg-transparent")} 
              />
              <div 
                onClick={(e) => handleSurfaceClick(e, "center")}
                className={cn("absolute top-1/4 left-1/4 right-1/4 bottom-1/4 border border-border/10", currentData.surfaces.includes("center") ? STATUS_CONFIG[currentData.status].color : "bg-transparent")} 
              />
              
              {/* Visual indicators for whole tooth status */}
              {currentData.status === "extraction" && <div className="absolute inset-0 flex items-center justify-center text-white font-bold drop-shadow-md">X</div>}
              {currentData.status === "missing" && <div className="absolute inset-0 flex items-center justify-center text-slate-500">?</div>}
              {currentData.status === "endodontics" && <div className="absolute inset-0 flex items-center justify-center"><div className="w-1 h-full bg-green-400 rotate-45 opacity-50" /></div>}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-semibold">Diente {id}</p>
          <p className="text-[10px] text-muted-foreground">{STATUS_CONFIG[currentData.status].label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const Odontogram = ({ data, onChange, readOnly }: OdontogramProps) => {
  const [activeStatus, setActiveStatus] = useState<ToothStatus>("cavity");

  return (
    <div className="flex flex-col gap-8 p-6 bg-card rounded-xl border shadow-xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Arcada Superior</h3>
          <Badge variant="outline" className="text-[10px] bg-primary/5">ADULTO PERMANENTE</Badge>
        </div>
        <div className="flex gap-1.5 justify-center overflow-x-auto pb-4 custom-scrollbar">
          {ADULT_TEETH_UPPER.map(id => (
            <Tooth 
              key={id} 
              id={id} 
              data={data[id.toString()]} 
              activeStatus={activeStatus}
              onUpdate={(d) => onChange(id.toString(), d)} 
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dashed border-border/50" /></div>
        <div className="relative flex justify-center"><span className="bg-card px-3 text-[10px] text-muted-foreground font-medium">LÍNEA MEDIA</span></div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-1.5 justify-center overflow-x-auto pb-4 custom-scrollbar">
          {ADULT_TEETH_LOWER.map(id => (
            <Tooth 
              key={id} 
              id={id} 
              data={data[id.toString()]} 
              activeStatus={activeStatus}
              onUpdate={(d) => onChange(id.toString(), d)} 
              readOnly={readOnly}
            />
          ))}
        </div>
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Arcada Inferior</h3>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-6">
          <div className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider text-center">Barra de Herramientas (Selecciona un estado y toca los dientes)</div>
          <div className="flex flex-wrap justify-center gap-2 p-4 bg-muted/30 rounded-2xl border border-border/50 backdrop-blur-sm">
            {(Object.entries(STATUS_CONFIG) as [ToothStatus, any][]).map(([status, config]) => (
              <Button
                key={status}
                variant={activeStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveStatus(status)}
                className={cn(
                  "h-10 px-4 rounded-xl gap-2 transition-all",
                  activeStatus === status ? "scale-105 shadow-md" : "hover:bg-background"
                )}
              >
                <div className={cn("w-3 h-3 rounded-full shadow-sm", config.color)} />
                <span className="text-xs font-semibold">{config.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
