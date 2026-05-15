import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const STATUS_COLORS: Record<ToothStatus, string> = {
  healthy: "bg-slate-100 dark:bg-slate-800",
  cavity: "bg-red-500",
  filling: "bg-blue-500",
  missing: "bg-slate-400",
  crown: "bg-yellow-500",
  extraction: "bg-purple-500",
  endodontics: "bg-green-500",
};

const Tooth = ({ id, data, onUpdate, readOnly }: { id: number, data?: ToothData, onUpdate: (d: ToothData) => void, readOnly?: boolean }) => {
  const currentData = data || { status: "healthy", surfaces: [] };

  const toggleSurface = (surface: string) => {
    if (readOnly) return;
    const newSurfaces = currentData.surfaces.includes(surface)
      ? currentData.surfaces.filter(s => s !== surface)
      : [...currentData.surfaces, surface];
    onUpdate({ ...currentData, surfaces: newSurfaces });
  };

  const setStatus = (status: ToothStatus) => {
    if (readOnly) return;
    onUpdate({ ...currentData, status });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold text-muted-foreground">{id}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            "relative w-8 h-8 border-2 rounded-sm transition-all hover:scale-110",
            currentData.status === "missing" ? "opacity-30" : "opacity-100"
          )}>
            {/* Surfaces */}
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSurface("top"); }}
              className={cn("absolute top-0 left-0 right-0 h-1/4 border-b", currentData.surfaces.includes("top") ? STATUS_COLORS[currentData.status] : "bg-transparent")} 
            />
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSurface("bottom"); }}
              className={cn("absolute bottom-0 left-0 right-0 h-1/4 border-t", currentData.surfaces.includes("bottom") ? STATUS_COLORS[currentData.status] : "bg-transparent")} 
            />
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSurface("left"); }}
              className={cn("absolute top-0 left-0 bottom-0 w-1/4 border-r", currentData.surfaces.includes("left") ? STATUS_COLORS[currentData.status] : "bg-transparent")} 
            />
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSurface("right"); }}
              className={cn("absolute top-0 right-0 bottom-0 w-1/4 border-l", currentData.surfaces.includes("right") ? STATUS_COLORS[currentData.status] : "bg-transparent")} 
            />
            <div 
              onClick={(e) => { e.stopPropagation(); toggleSurface("center"); }}
              className={cn("absolute top-1/4 left-1/4 right-1/4 bottom-1/4", currentData.surfaces.includes("center") ? STATUS_COLORS[currentData.status] : "bg-transparent")} 
            />
            
            {/* Status Icons for whole tooth */}
            {currentData.status === "extraction" && <div className="absolute inset-0 flex items-center justify-center text-red-500 font-bold">X</div>}
            {currentData.status === "missing" && <div className="absolute inset-0 flex items-center justify-center text-slate-500">?</div>}
          </button>
        </PopoverTrigger>
        {!readOnly && (
          <PopoverContent className="w-48 p-2">
            <div className="grid grid-cols-1 gap-1">
              {(Object.keys(STATUS_COLORS) as ToothStatus[]).map(s => (
                <Button 
                  key={s} 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => setStatus(s)}
                >
                  <div className={cn("w-3 h-3 rounded-full", STATUS_COLORS[s])} />
                  <span className="capitalize">{s === 'healthy' ? 'Sano' : s === 'cavity' ? 'Caries' : s === 'filling' ? 'Obturación' : s === 'missing' ? 'Ausente' : s === 'crown' ? 'Corona' : s === 'extraction' ? 'Exodoncia' : 'Endodoncia'}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};

export const Odontogram = ({ data, onChange, readOnly }: OdontogramProps) => {
  return (
    <div className="flex flex-col gap-8 p-6 overflow-x-auto bg-card rounded-xl border shadow-sm">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2">Arcada Superior</h3>
        <div className="flex gap-2 min-w-max pb-2">
          {ADULT_TEETH_UPPER.map(id => (
            <Tooth 
              key={id} 
              id={id} 
              data={data[id.toString()]} 
              onUpdate={(d) => onChange(id.toString(), d)} 
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-border w-full" />

      <div className="flex flex-col gap-2">
        <div className="flex gap-2 min-w-max pt-2">
          {ADULT_TEETH_LOWER.map(id => (
            <Tooth 
              key={id} 
              id={id} 
              data={data[id.toString()]} 
              onUpdate={(d) => onChange(id.toString(), d)} 
              readOnly={readOnly}
            />
          ))}
        </div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-2 text-right">Arcada Inferior</h3>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg border border-dashed">
        <div className="text-xs font-medium text-muted-foreground w-full mb-1">Leyenda de estados:</div>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", color)} />
            <span className="text-[11px] capitalize">{status === 'healthy' ? 'Sano' : status === 'cavity' ? 'Caries' : status === 'filling' ? 'Obturación' : status === 'missing' ? 'Ausente' : status === 'crown' ? 'Corona' : status === 'extraction' ? 'Exodoncia' : 'Endodoncia'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
