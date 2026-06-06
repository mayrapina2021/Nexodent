import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPaymentPlans, createPaymentPlan, getPlanInstallments, getOverdueInstallments, markInstallmentPaid } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Plus, AlertTriangle } from "lucide-react";

interface Props {
  patients: { id: number; name: string }[];
}

export function PaymentPlansPanel({ patients }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [form, setForm] = useState({
    patientId: "", treatmentName: "", totalAmount: "", downPayment: "0",
    installmentCount: "3", frequency: "monthly", startDate: new Date().toISOString().slice(0, 10),
  });

  const { data: plans = [] } = useQuery({ queryKey: ["payment-plans"], queryFn: () => listPaymentPlans() });
  const { data: overdue = [] } = useQuery({ queryKey: ["overdue-installments"], queryFn: getOverdueInstallments });
  const { data: installments = [] } = useQuery({
    queryKey: ["plan-installments", selectedPlan],
    queryFn: () => getPlanInstallments(selectedPlan!),
    enabled: !!selectedPlan,
  });

  const createMutation = useMutation({
    mutationFn: createPaymentPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-plans"] });
      setOpen(false);
      toast({ title: "Plan de pago creado" });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => markInstallmentPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan-installments", selectedPlan] });
      queryClient.invalidateQueries({ queryKey: ["overdue-installments"] });
      toast({ title: "Cuota marcada como pagada" });
    },
  });

  const handleCreate = () => {
    if (!form.patientId || !form.treatmentName || !form.totalAmount) return;
    createMutation.mutate({
      patientId: parseInt(form.patientId, 10),
      treatmentName: form.treatmentName,
      totalAmount: parseInt(form.totalAmount, 10),
      downPayment: parseInt(form.downPayment, 10) || 0,
      installmentCount: parseInt(form.installmentCount, 10),
      frequency: form.frequency,
      startDate: form.startDate,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="w-5 h-5" /> Planes de Pago</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> Nuevo plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear plan de financiación</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}>
                <SelectTrigger><SelectValue placeholder="Paciente" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Tratamiento" value={form.treatmentName} onChange={(e) => setForm({ ...form, treatmentName: e.target.value })} />
              <Input type="number" placeholder="Valor total" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
              <Input type="number" placeholder="Cuota inicial" value={form.downPayment} onChange={(e) => setForm({ ...form, downPayment: e.target.value })} />
              <Input type="number" placeholder="Número de cuotas" value={form.installmentCount} onChange={(e) => setForm({ ...form, installmentCount: e.target.value })} />
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quincenal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Button onClick={handleCreate} disabled={createMutation.isPending}>Crear plan</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {(overdue as { installmentId: number; patientName: string; amount: number; dueDate: string }[]).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4" /> Cuotas vencidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(overdue as { installmentId: number; patientName: string; amount: number; dueDate: string; treatmentName: string }[]).map((o) => (
              <div key={o.installmentId} className="flex justify-between text-sm">
                <span>{o.patientName} — {o.treatmentName} (${o.amount.toLocaleString()}) vence {o.dueDate}</span>
                <Button size="sm" variant="outline" onClick={() => payMutation.mutate(o.installmentId)}>Marcar pagada</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedPlan(plan.id)}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">{plan.patientName}</div>
                <div className="text-sm text-muted-foreground">{plan.treatmentName} — ${plan.totalAmount.toLocaleString()}</div>
                <div className="text-xs">{plan.installmentCount} cuotas de ${plan.installmentAmount.toLocaleString()} ({plan.frequency})</div>
              </div>
              <Badge variant={plan.status === "active" ? "default" : "secondary"}>{plan.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedPlan && installments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Cuotas del plan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {installments.map((inst) => (
              <div key={inst.id} className="flex justify-between items-center text-sm border-b pb-2">
                <span>Cuota {inst.installmentNumber} — {inst.dueDate} — ${inst.amount.toLocaleString()}</span>
                <div className="flex gap-2 items-center">
                  <Badge variant={inst.status === "paid" ? "default" : "outline"}>{inst.status}</Badge>
                  {inst.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => payMutation.mutate(inst.id)}>Pagar</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
