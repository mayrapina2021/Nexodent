import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Package, AlertTriangle, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Supply {
  id: number;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [form, setForm] = useState({ name: "", category: "", quantity: 0, minQuantity: 5, unit: "unidades" });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: supplies, isLoading } = useQuery<Supply[]>({
    queryKey: ["supplies"],
    queryFn: () => customFetch("/api/inventory/supplies", { method: "GET" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => customFetch("/api/inventory/supplies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setDialogOpen(false);
      toast({ title: "Insumo agregado" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => customFetch(`/api/inventory/supplies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setDialogOpen(false);
      toast({ title: "Inventario actualizado" });
    },
  });

  const filteredSupplies = supplies?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (selectedSupply) {
      updateMutation.mutate({ id: selectedSupply.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const updateQuantity = (supply: Supply, delta: number) => {
    const newQuantity = Math.max(0, supply.quantity + delta);
    updateMutation.mutate({ id: supply.id, data: { ...supply, quantity: newQuantity } });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventario de Insumos</h1>
            <p className="text-muted-foreground mt-1">Control simplificado de materiales críticos.</p>
          </div>
          <Button onClick={() => { setSelectedSupply(null); setForm({ name: "", category: "", quantity: 0, minQuantity: 5, unit: "unidades" }); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nuevo Insumo
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar insumo por nombre o categoría..." 
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSupplies?.map((supply) => {
                  const isLow = supply.quantity <= supply.minQuantity;
                  return (
                    <TableRow key={supply.id}>
                      <TableCell className="font-medium">{supply.name}</TableCell>
                      <TableCell><Badge variant="outline">{supply.category}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(supply, -1)}><Minus className="h-3 w-3" /></Button>
                          <span className={cn("font-bold min-w-[30px] text-center", isLow ? "text-red-500" : "text-foreground")}>
                            {supply.quantity}
                          </span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(supply, 1)}><Plus className="h-3 w-3" /></Button>
                          <span className="text-xs text-muted-foreground">{supply.unit}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isLow ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="w-3 h-3" /> Crítico
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-none">Suficiente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { 
                          setSelectedSupply(supply); 
                          setForm({ name: supply.name, category: supply.category, quantity: supply.quantity, minQuantity: supply.minQuantity, unit: supply.unit }); 
                          setDialogOpen(true); 
                        }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedSupply ? "Editar Insumo" : "Agregar Nuevo Insumo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nombre del material</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Guantes de Nitrilo M" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoría</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej: Desechables" />
              </div>
              <div className="grid gap-2">
                <Label>Unidad</Label>
                <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Ej: Cajas" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cantidad Actual</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label>Cantidad Mínima (Alerta)</Label>
                <Input type="number" value={form.minQuantity} onChange={e => setForm({ ...form, minQuantity: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {selectedSupply ? "Guardar Cambios" : "Agregar Insumo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
