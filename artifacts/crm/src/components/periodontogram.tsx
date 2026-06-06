import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PeriodontalToothData } from "@workspace/api-client-react";

const UPPER = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"];
const LOWER = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"];

function defaultTooth(): PeriodontalToothData {
  return { sites: [{ pd: 2, bop: false }, { pd: 2, bop: false }, { pd: 2, bop: false }], mobility: 0 };
}

interface Props {
  data: Record<string, PeriodontalToothData>;
  onChange: (toothId: string, data: PeriodontalToothData) => void;
}

function ToothCell({ id, tooth, onChange }: { id: string; tooth: PeriodontalToothData; onChange: (d: PeriodontalToothData) => void }) {
  const avgPd = tooth.sites.reduce((s, x) => s + x.pd, 0) / tooth.sites.length;
  const hasBop = tooth.sites.some((s) => s.bop);
  const severity = avgPd >= 5 || tooth.mobility >= 2 ? "border-red-500 bg-red-50" : avgPd >= 4 ? "border-amber-500 bg-amber-50" : "border-slate-200";

  return (
    <div className={`border rounded-lg p-2 text-center min-w-[72px] ${severity}`}>
      <div className="text-xs font-bold mb-1">{id}</div>
      <div className="flex gap-1 justify-center mb-1">
        {tooth.sites.map((site, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <Input
              type="number" min={0} max={12} className="h-6 w-8 text-xs p-0 text-center"
              value={site.pd}
              onChange={(e) => {
                const sites = [...tooth.sites];
                sites[i] = { ...sites[i], pd: parseInt(e.target.value, 10) || 0 };
                onChange({ ...tooth, sites });
              }}
            />
            <Checkbox
              checked={site.bop}
              onCheckedChange={(v) => {
                const sites = [...tooth.sites];
                sites[i] = { ...sites[i], bop: !!v };
                onChange({ ...tooth, sites });
              }}
              className="h-3 w-3"
            />
          </div>
        ))}
      </div>
      <select
        className="text-[10px] w-full border rounded"
        value={tooth.mobility}
        onChange={(e) => onChange({ ...tooth, mobility: parseInt(e.target.value, 10) })}
      >
        {[0,1,2,3].map((m) => <option key={m} value={m}>M{m}</option>)}
      </select>
      {hasBop && <div className="text-[9px] text-red-600 mt-0.5">BOP+</div>}
    </div>
  );
}

export function Periodontogram({ data, onChange }: Props) {
  const renderRow = (teeth: string[]) => (
    <div className="flex flex-wrap gap-2 justify-center">
      {teeth.map((id) => (
        <ToothCell key={id} id={id} tooth={data[id] ?? defaultTooth()} onChange={(d) => onChange(id, d)} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs text-muted-foreground justify-center">
        <span><Label>PD</Label> = Profundidad de sondaje (mm)</span>
        <span><Checkbox disabled className="h-3 w-3" /> = Sangrado al sondaje (BOP)</span>
        <span>M = Movilidad (0-3)</span>
      </div>
      <div className="text-sm font-medium text-center">Arcada Superior</div>
      {renderRow(UPPER)}
      <div className="text-sm font-medium text-center">Arcada Inferior</div>
      {renderRow(LOWER)}
    </div>
  );
}
