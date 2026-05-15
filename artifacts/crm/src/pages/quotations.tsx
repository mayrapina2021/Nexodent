import Layout from "@/components/layout";
import { 
  useListPatients, 
  useListQuotations, 
  useCreateQuotation, 
  useUpdateQuotation, 
  useListTreatments,
  getListQuotationsQueryKey,
  customFetch
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Plus, FileText, Send, Trash2, Pencil, DollarSign, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type QuotationItem = { service: string; price: number };

// ── Payment Dialog ──────────────────────────────────────────────────────────
function PaymentDialog({ quotation, open, onClose }: { quotation: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", quotation?.id],
    queryFn: () => customFetch(`/api/clinical/quotations/${quotation.id}/payments`),
    enabled: open && !!quotation?.id,
  });

  const addPayment = useMutation({
    mutationFn: (data: any) => customFetch("/api/clinical/payments", { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      toast({ title: "✅ Abono registrado" });
      qc.invalidateQueries({ queryKey: ["payments", quotation.id] });
      setAmount("");
      setReference("");
    },
    onError: () => toast({ variant: "destructive", title: "Error al registrar el abono" }),
  });

  const deletePayment = useMutation({
    mutationFn: (id: number) => customFetch(`/api/clinical/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments", quotation.id] }),
  });

  const totalPaid = (payments as any[])?.reduce((s: number, p: any) => s + parseFloat(p.amount), 0) ?? 0;
  const balance = (quotation?.total ?? 0) - totalPaid;

  const methodLabel: Record<string, string> = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta" };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>💰 Control de Pagos — {quotation?.patientName}</DialogTitle>
        </DialogHeader>

        {/* Resumen financiero */}
        <div className="grid grid-cols-3 gap-3 my-2">
          {[
            { label: "Total Presupuesto", value: quotation?.total ?? 0, color: "text-foreground" },
            { label: "Total Pagado", value: totalPaid, color: "text-green-400" },
            { label: "Saldo Pendiente", value: balance, color: balance > 0 ? "text-yellow-400" : "text-green-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`font-bold text-sm ${color}`}>${value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Nuevo abono */}
        <div className="space-y-3 border-t border-border/50 pt-4">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Registrar Abono</Label>
          <div className="flex gap-2">
            <Input type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} className="bg-background" />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-40 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Referencia (opcional)" value={reference} onChange={e => setReference(e.target.value)} className="bg-background" />
          <Button
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={!amount || addPayment.isPending}
            onClick={() => addPayment.mutate({ quotationId: quotation.id, amount: parseFloat(amount), method, reference: reference || undefined })}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            {addPayment.isPending ? "Guardando..." : "Registrar Abono"}
          </Button>
        </div>

        {/* Historial de abonos */}
        <div className="border-t border-border/50 pt-4 space-y-2 max-h-48 overflow-y-auto">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Historial de Abonos</Label>
          {isLoading && <Skeleton className="h-10 w-full" />}
          {!(payments as any[])?.length && !isLoading && (
            <p className="text-xs text-muted-foreground text-center py-4">No hay abonos registrados aún</p>
          )}
          {(payments as any[])?.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between bg-muted/10 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-green-400">${parseFloat(p.amount).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{methodLabel[p.method] ?? p.method} · {new Date(p.date).toLocaleDateString()}</p>
                {p.reference && <p className="text-xs text-muted-foreground">Ref: {p.reference}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deletePayment.mutate(p.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function Quotations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [items, setItems] = useState<QuotationItem[]>([{ service: "", price: 0 }]);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients } = useListPatients();
  const { data: quotations, isLoading } = useListQuotations();
  const { data: treatments } = useListTreatments();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pId = urlParams.get("patientId");
    const itemsJson = urlParams.get("items");
    if (pId) {
      setSelectedPatientId(pId);
      if (itemsJson) {
        try { setItems(JSON.parse(decodeURIComponent(itemsJson))); } catch {}
      }
      setDialogOpen(true);
      window.history.replaceState({}, document.title, "/quotations");
    }
  }, []);

  const addItem = () => setItems([...items, { service: "", price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: field === "price" ? parseInt(value) || 0 : value };
    if (field === "service") {
      const t = treatments?.find(t => t.name === value);
      if (t) newItems[idx].price = Math.round(parseFloat(t.price as any));
    }
    setItems(newItems);
  };

  const openEdit = (q: any) => { setEditingId(q.id); setSelectedPatientId(q.patientId.toString()); setItems(q.items); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setItems([{ service: "", price: 0 }]); setSelectedPatientId(""); };
  const total = items.reduce((s, i) => s + i.price, 0);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este presupuesto?")) return;
    try {
      await customFetch(`/api/clinical/quotations/${id}`, { method: "DELETE" });
      toast({ title: "Presupuesto eliminado" });
      invalidate();
    } catch { toast({ variant: "destructive", title: "Error al eliminar" }); }
  };

  const handleCreate = (sendToWhatsApp: boolean) => {
    if (!selectedPatientId) { toast({ variant: "destructive", title: "Selecciona un paciente" }); return; }
    if (items.some(i => !i.service || i.price <= 0)) { toast({ variant: "destructive", title: "Completa los servicios y precios" }); return; }
    setSending(sendToWhatsApp);
    const payload = { patientId: parseInt(selectedPatientId), items, total, sendToWhatsApp };
    if (editingId) {
      updateQuotation.mutate({ id: editingId, data: payload as any }, { onSuccess: () => { toast({ title: sendToWhatsApp ? "Actualizado y enviado" : "Actualizado" }); closeDialog(); invalidate(); }, onSettled: () => setSending(false) });
    } else {
      createQuotation.mutate({ data: payload as any }, { onSuccess: () => { toast({ title: sendToWhatsApp ? "Enviado por WhatsApp" : "Presupuesto creado" }); closeDialog(); invalidate(); }, onSettled: () => setSending(false) });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
            <p className="text-muted-foreground mt-1">Genera, envía y controla el pago de tus cotizaciones</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Presupuesto
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : !quotations?.length ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No hay presupuestos generados aún</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {quotations.map(q => (
              <Card key={q.id} className="bg-card/80 border-border/50 overflow-hidden group">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 bg-muted/20">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{(q as any).patientName}</h3>
                        <p className="text-xs text-muted-foreground">#{q.id} · {new Date(q.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">${q.total.toLocaleString()}</p>
                        <Badge className={q.status === "sent" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}>
                          {q.status === "sent" ? "Enviado" : "Borrador"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => setPaymentTarget(q)} className="text-accent hover:bg-accent/10">
                          <DollarSign className="h-4 w-4 mr-1" /> Abono
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(q)}>
                          <Pencil className="h-4 w-4 mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                        {expandedId === q.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  {expandedId === q.id && (
                    <div className="p-4 border-t border-border/30">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {q.items.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span>{item.service}</span>
                            <span>${item.price.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: Crear/Editar Presupuesto */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Presupuesto" : "Generar Presupuesto Profesional"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Paciente</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId} disabled={!!editingId}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Busca un paciente..." /></SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {patients?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.phone})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Servicios / Tratamientos</Label>
                <Button variant="ghost" size="sm" onClick={addItem} className="text-accent h-7 px-2">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
                </Button>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start bg-muted/10 p-2 rounded-lg border border-border/30">
                    <div className="flex-1 flex gap-2">
                      <Input placeholder="Servicio / Tratamiento" value={item.service} onChange={e => updateItem(idx, "service", e.target.value)} className="bg-background flex-1" />
                      <Select onValueChange={v => updateItem(idx, "service", v)}>
                        <SelectTrigger className="w-10 px-0 flex justify-center bg-muted/20">
                          <Plus className="h-4 w-4" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[250px] overflow-y-auto">
                          <Label className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase">Del catálogo</Label>
                          {treatments?.map(t => <SelectItem key={t.id} value={t.name}>{t.name} (${t.price})</SelectItem>)}
                          {!treatments?.length && <div className="p-2 text-xs text-muted-foreground">Sin tratamientos en catálogo</div>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Input type="number" placeholder="Precio" value={item.price || ""} onChange={e => updateItem(idx, "price", e.target.value)} className="bg-background text-right" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length === 1} className="text-muted-foreground hover:text-destructive h-10 w-10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 flex justify-between items-center">
              <div className="text-muted-foreground">
                <p className="text-sm">Total Presupuesto</p>
                <p className="text-2xl font-bold text-accent">${total.toLocaleString()}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => handleCreate(false)}>Solo Guardar</Button>
                <Button onClick={() => handleCreate(true)} disabled={createQuotation.isPending || updateQuotation.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Enviando..." : editingId ? "Actualizar y Enviar" : "Crear y Enviar WhatsApp"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Control de Pagos */}
      {paymentTarget && (
        <PaymentDialog
          quotation={paymentTarget}
          open={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
        />
      )}
    </Layout>
  );
}
