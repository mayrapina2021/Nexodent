import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getPatient, 
  getOdontogram, 
  updateOdontogram, 
  listEvolutionNotes, 
  createEvolutionNote,
  getSettings
} from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Odontogram, ToothData } from "@/components/odontogram";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Save, History, FileText, ClipboardList, ReceiptText, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function ClinicalHistory() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/clinical/:patientId");
  const patientId = params?.patientId ? parseInt(params.patientId, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  });

  const { data: odontogramData } = useQuery({
    queryKey: ["odontogram", patientId],
    queryFn: () => getOdontogram(patientId),
    enabled: !!patientId,
  });

  const { data: notes } = useQuery({
    queryKey: ["notes", patientId],
    queryFn: () => listEvolutionNotes({ patientId }),
    enabled: !!patientId,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });

  const updateOdontogramMutation = useMutation({
    mutationFn: (data: any) => updateOdontogram(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["odontogram", patientId] });
      toast({ title: "Odontograma actualizado", description: "Los cambios se han guardado correctamente." });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => createEvolutionNote({ patientId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
      setNewNote("");
      toast({ title: "Nota guardada", description: "La evolución clínica ha sido registrada." });
    },
  });

  const handleOdontogramChange = (toothId: string, toothData: ToothData) => {
    const currentData = (odontogramData?.data as any) || {};
    const newData = { ...currentData, [toothId]: toothData };
    updateOdontogramMutation.mutate({ data: newData });
  };

  const handleSaveNote = () => {
    if (!newNote.trim()) return;
    createNoteMutation.mutate(newNote);
  };

  const handleCreateQuotationFromOdontogram = () => {
    const data = (odontogramData?.data as any) || {};
    const items: { service: string; price: number }[] = [];
    
    // Map tooth status to services
    Object.entries(data).forEach(([toothId, tooth]: [string, any]) => {
      if (tooth.status === 'cavity') items.push({ service: `Resina en diente ${toothId}`, price: 150000 });
      if (tooth.status === 'extraction') items.push({ service: `Exodoncia de diente ${toothId}`, price: 200000 });
      if (tooth.status === 'endodontics') items.push({ service: `Endodoncia de diente ${toothId}`, price: 450000 });
      if (tooth.status === 'crown') items.push({ service: `Corona en diente ${toothId}`, price: 800000 });
    });

    if (items.length === 0) {
      toast({ title: "Sin hallazgos", description: "No hay tratamientos pendientes marcados en el odontograma." });
      return;
    }

    const itemsParam = encodeURIComponent(JSON.stringify(items));
    setLocation(`/quotations?patientId=${patientId}&items=${itemsParam}`);
  };

  const handleExportRIPS = async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const dateStr = format(new Date(), "ddMMyyyy");
      const codPrestador = (settings as any)?.habilitationCode || "000000000000";
      const codMunicipio = "05001"; // Medellín default
      
      // 1. Archivo de Usuarios (US)
      const usContent = [
        patient?.phone?.slice(-10) || "0000000000", // ID simplificado
        "CC", 
        patient?.phone?.slice(-10) || "0", 
        "01", // EPS placeholder (General)
        "1", // Tipo usuario (Contributivo)
        patient?.name?.split(" ")[1] || "APELLIDO1",
        patient?.name?.split(" ")[2] || "",
        patient?.name?.split(" ")[0] || "NOMBRE1",
        "", 
        "30", // Edad
        "1", // Unidad edad (años)
        "M", // Sexo
        codMunicipio,
        "U" // Zona
      ].join(",") + "\r\n";
      zip.file(`US${dateStr}.txt`, usContent);

      // 2. Archivo de Consultas (AC)
      let acContent = "";
      notes?.forEach(n => {
        acContent += [
          "1", // Factura placeholder
          codPrestador,
          "CC",
          patient?.phone?.slice(-10) || "0",
          format(new Date(n.createdAt), "dd/MM/yyyy"),
          "", // Autorización
          "890203", // Código consulta Odontología
          "1", // Finalidad
          "10", // Causa externa (Enf General)
          "K021", // DX Principal (Caries)
          "", "", "", // DX Relacionados
          "1", // Tipo DX
          "0", "0", "0" // Valores
        ].join(",") + "\r\n";
      });
      zip.file(`AC${dateStr}.txt`, acContent);

      // 3. Archivo de Control (CT)
      const ctContent = [
        [codPrestador, format(new Date(), "dd/MM/yyyy"), `US${dateStr}`, "1"].join(","),
        [codPrestador, format(new Date(), "dd/MM/yyyy"), `AC${dateStr}`, (notes?.length || 0).toString()].join(",")
      ].join("\r\n");
      zip.file(`CT${dateStr}.txt`, ctContent);

      // Generar y descargar ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RIPS_${patient.name.replace(/\s+/g, "_")}_${dateStr}.zip`;
      a.click();
      
      toast({ title: "RIPS Generado", description: "Se ha descargado el archivo ZIP con los archivos planos (AC, US, CT) en formato legal." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo generar el archivo RIPS.", variant: "destructive" });
    }
  };

  if (!patient) return null;

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historia Clínica</h1>
            <p className="text-muted-foreground">
              Paciente: <span className="font-semibold text-foreground">{patient?.name}</span> • ID: {patient?.id}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportRIPS} className="gap-2">
              <FileDown className="w-4 h-4" /> Exportar RIPS
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateQuotationFromOdontogram} className="gap-2">
              <ReceiptText className="w-4 h-4" /> Crear Presupuesto
            </Button>
            <Badge variant="outline" className="text-xs">
              Última actualización: {odontogramData?.updatedAt ? format(new Date(odontogramData.updatedAt), "dd/MM/yyyy") : "Nunca"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="odontogram" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="odontogram" className="gap-2">
              <ClipboardList className="w-4 h-4" /> Odontograma
            </TabsTrigger>
            <TabsTrigger value="evolution" className="gap-2">
              <History className="w-4 h-4" /> Evolución
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="w-4 h-4" /> Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="odontogram" className="mt-6">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="px-0">
                <CardTitle>Mapa Dental Interactivo</CardTitle>
                <CardDescription>Haga clic en un diente para marcar hallazgos o tratamientos.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Odontogram 
                  data={(odontogramData?.data as any) || {}} 
                  onChange={handleOdontogramChange} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evolution" className="mt-6 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Nueva Nota de Evolución</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Textarea 
                    placeholder="Escriba aquí los hallazgos de hoy, tratamiento realizado y plan a seguir..." 
                    className="min-h-[150px] resize-none"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <Button onClick={handleSaveNote} disabled={!newNote.trim() || createNoteMutation.isPending} className="self-end gap-2">
                    <Save className="w-4 h-4" /> Guardar Nota
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="w-full lg:w-[400px]">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Historial de Notas</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="flex flex-col">
                      {notes?.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          No hay notas registradas.
                        </div>
                      )}
                      {notes?.map((note, idx) => (
                        <div key={note.id} className="p-4 border-b last:border-none hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-primary capitalize">
                              {format(new Date(note.createdAt), "EEEE, d 'de' MMMM", { locale: es })}
                            </span>
                            <span className="text-[10px] text-muted-foreground italic">
                              {format(new Date(note.createdAt), "HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Consentimientos y Documentos</CardTitle>
                <CardDescription>Gestione firmas legales y archivos adjuntos.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Placeholder for future implementation */}
                  <div className="p-6 border rounded-xl border-dashed flex flex-col items-center justify-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <div className="font-medium">Nuevo Consentimiento</div>
                    <p className="text-xs text-muted-foreground">Generar documento para firma digital vía WhatsApp.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
