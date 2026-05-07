import Layout from "@/components/layout";
import { useListTreatments, useCreateTreatment, useUpdateTreatment, useDeleteTreatment, getListTreatmentsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Syringe, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type TreatForm = { name: string; description: string; price: string; duration: string; active: boolean };
const emptyForm: TreatForm = { name: "", description: "", price: "", duration: "60", active: true };

function formatCurrency(v: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);
}

export default function Treatments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TreatForm>(emptyForm);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: treatments, isLoading } = useListTreatments();
  const createTreat = useCreateTreatment();
  const updateTreat = useUpdateTreatment();
  const deleteTreat = useDeleteTreatment();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTreatmentsQueryKey() });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setForm({ name: t.name, description: t.description ?? "", price: String(t.price), duration: String(t.duration), active: t.active });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const data = { name: form.name, description: form.description || undefined, price: parseFloat(form.price), duration: parseInt(form.duration), active: form.active };
    if (editingId) {
      updateTreat.mutate({ id: editingId, data }, {
        onSuccess: () => { toast({ title: "Tratamiento actualizado" }); setDialogOpen(false); invalidate(); },
      });
    } else {
      createTreat.mutate({ data }, {
        onSuccess: () => { toast({ title: "Tratamiento creado" }); setDialogOpen(false); invalidate(); },
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tratamientos</h1>
            <p className="text-muted-foreground mt-1">Catálogo de servicios y tarifas</p>
          </div>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Tratamiento
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : !treatments?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Syringe className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay tratamientos en el catálogo</p>
            <p className="text-sm mt-1">Agrega los servicios que ofrece tu clínica</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {treatments.map(t => (
              <Card key={t.id} className="border-border/50 bg-card/80 hover:bg-card transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <Syringe className="h-4 w-4 text-primary-foreground/80" />
                      </div>
                      <h3 className="font-semibold text-foreground">{t.name}</h3>
                    </div>
                    <Badge className={t.active ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-400"}>
                      {t.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{t.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-accent font-bold">
                      <DollarSign className="h-4 w-4" />
                      {formatCurrency(t.price)}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {t.duration} min
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteTreat.mutate({ id: t.id }, { onSuccess: invalidate })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Tratamiento" : "Nuevo Tratamiento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nombre del tratamiento *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background" placeholder="Ej: Implantes dentales" />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-background" rows={2} placeholder="Descripción breve del tratamiento..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Precio (COP) *</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="bg-background" placeholder="Ej: 1500000" />
              </div>
              <div className="space-y-1">
                <Label>Duración (minutos)</Label>
                <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="bg-background" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label>Tratamiento activo (visible en la agenda)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createTreat.isPending || updateTreat.isPending} className="bg-primary">
              {editingId ? "Guardar cambios" : "Crear tratamiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
