import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listLabOrders, createLabOrder, updateLabOrder, useListPatients } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { FlaskConical, Plus } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  sent: "Enviado",
  received: "Recibido",
  delayed: "Retrasado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  delayed: "bg-amber-100 text-amber-800",
  cancelled: "bg-slate-100 text-slate-600",
};

export default function Lab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patientId: "", labName: "", workType: "", dueDate: "", notes: "" });

  const { data: orders = [] } = useQuery({ queryKey: ["lab-orders"], queryFn: () => listLabOrders() });
  const { data: patients = [] } = useListPatients();

  const createMutation = useMutation({
    mutationFn: createLabOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setOpen(false);
      setForm({ patientId: "", labName: "", workType: "", dueDate: "", notes: "" });
      toast({ title: "Orden de laboratorio creada" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateLabOrder(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-orders"] }),
  });

  const handleCreate = () => {
    if (!form.patientId || !form.labName || !form.workType) return;
    createMutation.mutate({
      patientId: parseInt(form.patientId, 10),
      labName: form.labName,
      workType: form.workType,
      dueDate: form.dueDate || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><FlaskConical className="w-8 h-8" /> Laboratorio</h1>
            <p className="text-muted-foreground">Órdenes de prótesis, coronas y trabajos externos</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Nueva orden</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva orden de laboratorio</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Paciente" /></SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Nombre del laboratorio" value={form.labName} onChange={(e) => setForm({ ...form, labName: e.target.value })} />
                <Input placeholder="Tipo de trabajo (corona, puente, etc.)" value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} />
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                <Input placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <Button onClick={handleCreate} disabled={createMutation.isPending}>Crear orden</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {orders.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No hay órdenes de laboratorio</CardContent></Card>
          )}
          {orders.map((o) => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row justify-between items-start pb-2">
                <div>
                  <CardTitle className="text-base">{o.workType}</CardTitle>
                  <p className="text-sm text-muted-foreground">{o.patientName} • {o.labName}</p>
                </div>
                <Badge className={STATUS_COLORS[o.status] ?? ""}>{STATUS_LABELS[o.status] ?? o.status}</Badge>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Enviado: {format(new Date(o.sentDate), "dd MMM yyyy", { locale: es })}
                  {o.dueDate && ` • Entrega: ${o.dueDate}`}
                </div>
                <div className="flex gap-2">
                  {o.status === "sent" && (
                    <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: o.id, status: "received" })}>
                      Marcar recibido
                    </Button>
                  )}
                  {o.status === "sent" && (
                    <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: o.id, status: "delayed" })}>
                      Retrasado
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
