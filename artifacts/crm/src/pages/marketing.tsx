import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInactivePatients, getMarketingStats, sendReactivation } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, UserX, UserPlus } from "lucide-react";

export default function Marketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");

  type InactivePatient = { id: number; name: string; phone: string; lastVisit: string | null };
  const { data: inactive = [] } = useQuery<InactivePatient[]>({ queryKey: ["inactive-patients"], queryFn: () => getInactivePatients(90) as Promise<InactivePatient[]> });
  const { data: stats } = useQuery({ queryKey: ["marketing-stats"], queryFn: getMarketingStats });

  const sendMutation = useMutation({
    mutationFn: () => sendReactivation([...selected], message || undefined),
    onSuccess: (res: { sent: number; total: number }) => {
      toast({ title: "Campaña enviada", description: `${res.sent} de ${res.total} mensajes enviados` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
    },
    onError: () => toast({ title: "Error", description: "WhatsApp no conectado o error al enviar", variant: "destructive" }),
  });

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(inactive.map((p) => p.id)));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="w-8 h-8" /> Marketing</h1>
          <p className="text-muted-foreground">Reactivación de pacientes inactivos vía WhatsApp</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <UserX className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-sm">Inactivos (+90 días)</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{(stats as { inactivePatients?: number })?.inactivePatients ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <UserPlus className="w-5 h-5 text-green-600" />
              <CardTitle className="text-sm">Nuevos este mes</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{(stats as { newPatientsThisMonth?: number })?.newPatientsThisMonth ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Leads perdidos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{(stats as { lostLeads?: number })?.lostLeads ?? 0}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row justify-between">
            <CardTitle>Pacientes inactivos</CardTitle>
            <Button variant="outline" size="sm" onClick={selectAll}>Seleccionar todos</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Mensaje personalizado (opcional)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.phone} • Última visita: {p.lastVisit ?? "Nunca"}</div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={selected.size === 0 || sendMutation.isPending}
              className="w-full"
            >
              Enviar reactivación a {selected.size} paciente(s)
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
