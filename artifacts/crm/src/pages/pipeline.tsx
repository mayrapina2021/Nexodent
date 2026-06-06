import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPipeline, updatePipelineStage } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { TrendingUp, Users, DollarSign } from "lucide-react";

const STAGE_COLORS: Record<string, string> = {
  new: "border-t-blue-500",
  contacted: "border-t-cyan-500",
  scheduled: "border-t-amber-500",
  attended: "border-t-emerald-500",
  in_treatment: "border-t-violet-500",
  won: "border-t-green-600",
  lost: "border-t-slate-400",
};

export default function Pipeline() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery({ queryKey: ["pipeline"], queryFn: getPipeline });

  const moveMutation = useMutation({
    mutationFn: ({ patientId, status }: { patientId: number; status: string }) =>
      updatePipelineStage(patientId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      toast({ title: "Paciente movido" });
    },
  });

  const handleDragStart = (e: React.DragEvent, patientId: number) => {
    e.dataTransfer.setData("patientId", String(patientId));
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const patientId = parseInt(e.dataTransfer.getData("patientId"), 10);
    if (patientId) moveMutation.mutate({ patientId, status });
  };

  if (isLoading) return <Layout><div className="p-6">Cargando pipeline...</div></Layout>;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pipeline Comercial</h1>
          <p className="text-muted-foreground">Arrastra pacientes entre etapas del embudo de ventas</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle className="text-sm">Total pacientes</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{data?.stats.totalPatients ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-sm">Valor en pipeline</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">${(data?.stats.totalValue ?? 0).toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              <CardTitle className="text-sm">Valor cerrado</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">${(data?.stats.wonValue ?? 0).toLocaleString()}</div></CardContent>
          </Card>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {data?.stages.map((stage) => (
            <div
              key={stage.id}
              className={`min-w-[260px] flex-shrink-0 bg-muted/30 rounded-xl border-t-4 ${STAGE_COLORS[stage.id] ?? "border-t-slate-300"}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="p-3 border-b flex justify-between items-center">
                <span className="font-semibold text-sm">{stage.label}</span>
                <Badge variant="secondary">{stage.count}</Badge>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] max-h-[60vh] overflow-y-auto">
                {stage.patients.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.id)}
                    onClick={() => setLocation(`/clinical/${p.id}`)}
                    className="bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.phone}</div>
                    {p.treatment && <div className="text-xs mt-1 text-primary">{p.treatment}</div>}
                    {p.treatmentPrice && (
                      <div className="text-xs font-semibold mt-1">${p.treatmentPrice.toLocaleString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
