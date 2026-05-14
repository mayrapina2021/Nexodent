import Layout from "@/components/layout";
import { useListPatients, useListQuotations, useCreateQuotation, getListQuotationsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, FileText, Send, Trash2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type QuotationItem = { service: string; price: number };

export default function Quotations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [items, setItems] = useState<QuotationItem[]>([{ service: "", price: 0 }]);
  const [sending, setSending] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients } = useListPatients();
  const { data: quotations, isLoading } = useListQuotations();
  const createQuotation = useCreateQuotation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });

  const addItem = () => setItems([...items, { service: "", price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: field === "price" ? parseInt(value) || 0 : value };
    setItems(newItems);
  };

  const total = items.reduce((sum, item) => sum + item.price, 0);

  const handleCreate = (sendToWhatsApp: boolean) => {
    if (!selectedPatientId) {
      toast({ variant: "destructive", title: "Selecciona un paciente" });
      return;
    }
    if (items.some(i => !i.service || i.price <= 0)) {
      toast({ variant: "destructive", title: "Completa los servicios y precios" });
      return;
    }

    setSending(sendToWhatsApp);
    createQuotation.mutate({
      data: {
        patientId: parseInt(selectedPatientId),
        items,
        total,
        sendToWhatsApp
      }
    }, {
      onSuccess: () => {
        toast({ title: sendToWhatsApp ? "Presupuesto enviado por WhatsApp" : "Presupuesto creado" });
        setDialogOpen(false);
        setItems([{ service: "", price: 0 }]);
        setSelectedPatientId("");
        invalidate();
      },
      onSettled: () => setSending(false)
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
            <p className="text-muted-foreground mt-1">Genera y envía cotizaciones profesionales</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Presupuesto
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
              <Card key={q.id} className="bg-card/80 border-border/50 overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-4 bg-muted/20">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{q.patientName}</h3>
                        <p className="text-xs text-muted-foreground">ID: #{q.id} · {new Date(q.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-accent">${q.total.toLocaleString()}</p>
                        <Badge className={q.status === "sent" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}>
                          {q.status === "sent" ? "Enviado" : "Borrador"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-t border-border/30">
                    <div className="text-xs text-muted-foreground space-y-1">
                      {q.items.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{item.service}</span>
                          <span>${item.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Generar Presupuesto Profesional</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Paciente</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Busca un paciente..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {patients?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.phone})</SelectItem>
                  ))}
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
              
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input 
                      placeholder="Servicio (ej: Calza de resina)" 
                      value={item.service} 
                      onChange={e => updateItem(idx, "service", e.target.value)}
                      className="bg-background flex-1"
                    />
                    <Input 
                      type="number" 
                      placeholder="Precio" 
                      value={item.price || ""} 
                      onChange={e => updateItem(idx, "price", e.target.value)}
                      className="bg-background w-32 text-right"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length === 1} className="text-muted-foreground hover:text-destructive">
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
                <Button 
                  onClick={() => handleCreate(true)} 
                  disabled={createQuotation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Enviando..." : "Crear y Enviar WhatsApp"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
