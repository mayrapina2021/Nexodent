import React from "react";
import { cn } from "@/lib/utils";

type ToothState = "healthy" | "caries" | "filling" | "missing" | "crown" | "endodontics";

const stateColors: Record<ToothState, string> = {
  healthy: "bg-green-500/20 border-green-500/50",
  caries: "bg-red-500/50 border-red-500",
  filling: "bg-blue-500/50 border-blue-500",
  missing: "bg-gray-800 border-gray-600 opacity-20",
  crown: "bg-yellow-500/50 border-yellow-500",
  endodontics: "bg-purple-500/50 border-purple-500",
};

interface ToothProps {
  id: number;
  state: ToothState;
  onClick: () => void;
  label?: string;
}

const Tooth = ({ id, state, onClick, label }: ToothProps) => (
  <div 
    onClick={onClick}
    className={cn(
      "w-8 h-10 border-2 rounded-sm flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110",
      stateColors[state] || "bg-card border-border"
    )}
  >
    <span className="text-[10px] font-bold">{id}</span>
    {label && <span className="text-[8px] uppercase">{label}</span>}
  </div>
);

interface OdontogramProps {
  data: Record<number, ToothState>;
  onChange: (toothId: number, state: ToothState) => void;
  readonly?: boolean;
}

export default function Odontogram({ data, onChange, readonly }: OdontogramProps) {
  const upperTeeth = [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28]
  ];
  const lowerTeeth = [
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38]
  ];

  const cycleState = (id: number) => {
    if (readonly) return;
    const states: ToothState[] = ["healthy", "caries", "filling", "missing", "crown", "endodontics"];
    const current = data[id] || "healthy";
    const next = states[(states.indexOf(current) + 1) % states.length];
    onChange(id, next);
  };

  return (
    <div className="p-4 bg-card/50 rounded-xl border border-border/50 space-y-8 select-none">
      <div className="flex justify-center gap-12">
        {upperTeeth.map((quadrant, qIdx) => (
          <div key={qIdx} className="flex gap-1">
            {quadrant.map(id => (
              <Tooth key={id} id={id} state={data[id] || "healthy"} onClick={() => cycleState(id)} />
            ))}
          </div>
        ))}
      </div>
      
      <div className="flex justify-center gap-12">
        {lowerTeeth.map((quadrant, qIdx) => (
          <div key={qIdx} className="flex gap-1">
            {quadrant.map(id => (
              <Tooth key={id} id={id} state={data[id] || "healthy"} onClick={() => cycleState(id)} />
            ))}
          </div>
        ))}
      </div>

      {!readonly && (
        <div className="flex flex-wrap justify-center gap-4 pt-4 border-t border-border/30">
          {Object.entries(stateColors).map(([state, color]) => (
            <div key={state} className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full border", color)} />
              <span className="text-[10px] capitalize text-muted-foreground">{state}</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground italic ml-4">Haz clic en cada diente para cambiar su estado</p>
        </div>
      )}
    </div>
  );
}
