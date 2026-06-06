import React, { useState, useRef } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPatient,
  getOdontogram,
  updateOdontogram,
  listEvolutionNotes,
  createEvolutionNote,
  getSettings,
  getPeriodontogram,
  updatePeriodontogram,
  listGallery,
  createGalleryItem,
  deleteGalleryItem,
  listConsents,
  createConsent,
  sendConsentWhatsApp,
  signConsentInClinic,
  deleteConsent,
  createSoapNote,
  useUpdatePatient,
  type ConsentForm,
} from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Odontogram, ToothData } from "@/components/odontogram";
import { Periodontogram } from "@/components/periodontogram";
import { SignaturePad } from "@/components/signature-pad";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Save, History, FileText, ClipboardList, ReceiptText, FileDown, Image, Mic, Stethoscope, ArrowLeft, Eye, Copy, Send, Trash2, PenLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { PeriodontalToothData } from "@workspace/api-client-react";

export default function ClinicalHistory() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/clinical/:patientId");
  const patientId = params?.patientId ? parseInt(params.patientId, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [noteMode, setNoteMode] = useState<"general" | "soap">("general");
  const [soap, setSoap] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [consentType, setConsentType] = useState("general");
  const [viewConsent, setViewConsent] = useState<ConsentForm | null>(null);
  const [signConsent, setSignConsent] = useState<ConsentForm | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryCategory, setGalleryCategory] = useState("evolution");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const updatePatient = useUpdatePatient();

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

  const { data: perioData } = useQuery({
    queryKey: ["periodontogram", patientId],
    queryFn: () => getPeriodontogram(patientId),
    enabled: !!patientId,
  });

  const { data: notes } = useQuery({
    queryKey: ["notes", patientId],
    queryFn: () => listEvolutionNotes({ patientId }),
    enabled: !!patientId,
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ["gallery", patientId],
    queryFn: () => listGallery(patientId),
    enabled: !!patientId,
  });

  const { data: consents = [] } = useQuery({
    queryKey: ["consents", patientId],
    queryFn: () => listConsents(patientId),
    enabled: !!patientId,
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });

  React.useEffect(() => {
    if (patient) {
      setDiagnosis(patient.diagnosis ?? "");
      setTreatmentPlan(patient.medicalHistory ?? "");
    }
  }, [patient]);

  const updateOdontogramMutation = useMutation({
    mutationFn: (data: { data: Record<string, ToothData> }) => updateOdontogram(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["odontogram", patientId] });
      toast({ title: "Odontograma actualizado" });
    },
  });

  const updatePerioMutation = useMutation({
    mutationFn: (data: Record<string, PeriodontalToothData>) => updatePeriodontogram(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periodontogram", patientId] });
      toast({ title: "Periodontograma guardado" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => createEvolutionNote({ patientId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
      setNewNote("");
      toast({ title: "Nota guardada" });
    },
  });

  const createSoapMutation = useMutation({
    mutationFn: () => createSoapNote({ patientId, ...soap }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
      setSoap({ subjective: "", objective: "", assessment: "", plan: "" });
      toast({ title: "Nota SOAP guardada" });
    },
  });

  const createConsentMutation = useMutation({
    mutationFn: ({ sendWhatsApp }: { sendWhatsApp: boolean }) =>
      createConsent({ patientId, type: consentType, sendWhatsApp }),
    onSuccess: (data, { sendWhatsApp }) => {
      queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      if (sendWhatsApp && data.whatsappSent) {
        toast({ title: "Enviado por WhatsApp", description: "El paciente recibió el link para firmar." });
      } else if (sendWhatsApp) {
        toast({
          title: "Creado, pero WhatsApp no envió",
          description: "Conecte WhatsApp en el menú lateral y use «Enviar WA» en la lista.",
          variant: "destructive",
        });
      } else if (data.signUrl) {
        navigator.clipboard?.writeText(data.signUrl).catch(() => {});
        toast({
          title: "Consentimiento creado",
          description: "Estado: Pendiente de firma. Link copiado — compártalo o use «Enviar WA».",
        });
      }
    },
  });

  const sendConsentMutation = useMutation({
    mutationFn: sendConsentWhatsApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      toast({ title: "Enviado por WhatsApp" });
    },
    onError: () => {
      toast({ title: "No se pudo enviar", description: "Verifique que WhatsApp esté conectado.", variant: "destructive" });
    },
  });

  const deleteConsentMutation = useMutation({
    mutationFn: deleteConsent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      setViewConsent(null);
      setSignConsent(null);
      toast({ title: "Consentimiento eliminado" });
    },
  });

  const signInClinicMutation = useMutation({
    mutationFn: ({ id, signatureData }: { id: number; signatureData: string }) =>
      signConsentInClinic(id, signatureData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      setSignConsent(null);
      setViewConsent(null);
      toast({ title: "Consentimiento firmado", description: "Firma registrada correctamente." });
    },
    onError: () => {
      toast({ title: "Error al firmar", variant: "destructive" });
    },
  });

  const uploadGalleryMutation = useMutation({
    mutationFn: (imageUrl: string) => createGalleryItem({ patientId, imageUrl, category: galleryCategory }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery", patientId] });
      toast({ title: "Imagen agregada a la galería" });
    },
  });

  const deleteGalleryMutation = useMutation({
    mutationFn: deleteGalleryItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gallery", patientId] }),
  });

  const handleOdontogramChange = (toothId: string, toothData: ToothData) => {
    const currentData = (odontogramData?.data as Record<string, ToothData>) || {};
    updateOdontogramMutation.mutate({ data: { ...currentData, [toothId]: toothData } });
  };

  const handlePerioChange = (toothId: string, toothData: PeriodontalToothData) => {
    const currentData = ((perioData as { data?: Record<string, PeriodontalToothData> })?.data) || {};
    updatePerioMutation.mutate({ ...currentData, [toothId]: toothData });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => uploadGalleryMutation.mutate(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startVoiceDictation = (field: keyof typeof soap) => {
    type SpeechRec = { lang: string; onresult: (ev: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void; start: () => void };
    const win = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "No soportado", description: "Su navegador no soporta dictado por voz", variant: "destructive" });
      return;
    }
    const recognition = new SR();
    recognition.lang = "es-CO";
    recognition.onresult = (ev) => {
      const text = ev.results[0][0].transcript;
      setSoap((s) => ({ ...s, [field]: s[field] ? `${s[field]} ${text}` : text }));
    };
    recognition.start();
    toast({ title: "Escuchando...", description: "Hable ahora para dictar la nota" });
  };

  const handleCreateQuotationFromOdontogram = () => {
    const data = (odontogramData?.data as Record<string, ToothData>) || {};
    const items: { service: string; price: number }[] = [];
    Object.entries(data).forEach(([toothId, tooth]) => {
      if (tooth.status === "cavity") items.push({ service: `Resina en diente ${toothId}`, price: 150000 });
      if (tooth.status === "extraction") items.push({ service: `Exodoncia de diente ${toothId}`, price: 200000 });
      if (tooth.status === "endodontics") items.push({ service: `Endodoncia de diente ${toothId}`, price: 450000 });
      if (tooth.status === "crown") items.push({ service: `Corona en diente ${toothId}`, price: 800000 });
    });
    if (items.length === 0) {
      toast({ title: "Sin hallazgos", description: "No hay tratamientos pendientes en el odontograma." });
      return;
    }
    setLocation(`/quotations?patientId=${patientId}&items=${encodeURIComponent(JSON.stringify(items))}`);
  };

  const handleExportRIPS = async () => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const dateStr = format(new Date(), "ddMMyyyy");
      const codPrestador = (settings as { habilitationCode?: string })?.habilitationCode || "000000000000";
      const codMunicipio = "05001";

      const usContent = [
        patient?.phone?.slice(-10) || "0000000000", "CC",
        patient?.phone?.slice(-10) || "0", "01", "1",
        patient?.name?.split(" ")[1] || "APELLIDO1",
        patient?.name?.split(" ")[2] || "",
        patient?.name?.split(" ")[0] || "NOMBRE1",
        "", "30", "1", "M", codMunicipio, "U",
      ].join(",") + "\r\n";
      zip.file(`US${dateStr}.txt`, usContent);

      let acContent = "";
      notes?.forEach((n) => {
        acContent += [
          "1", codPrestador, "CC", patient?.phone?.slice(-10) || "0",
          format(new Date(n.createdAt), "dd/MM/yyyy"), "", "890203", "1", "10", "K021",
          "", "", "", "1", "0", "0", "0",
        ].join(",") + "\r\n";
      });
      zip.file(`AC${dateStr}.txt`, acContent);

      const ctContent = [
        [codPrestador, format(new Date(), "dd/MM/yyyy"), `US${dateStr}`, "1"].join(","),
        [codPrestador, format(new Date(), "dd/MM/yyyy"), `AC${dateStr}`, String(notes?.length || 0)].join(","),
      ].join("\r\n");
      zip.file(`CT${dateStr}.txt`, ctContent);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RIPS_${(patient?.name ?? "paciente").replace(/\s+/g, "_")}_${dateStr}.zip`;
      a.click();
      toast({ title: "RIPS generado", description: "Archivos AC, US, CT descargados." });
    } catch {
      toast({ title: "Error", description: "No se pudo generar RIPS.", variant: "destructive" });
    }
  };

  if (!patient) return null;

  const CONSENT_TYPE_LABELS: Record<string, string> = {
    general: "General",
    extraccion: "Extracción",
    implante: "Implante",
    endodoncia: "Endodoncia",
  };

  const consentStatusLabel = (status: string) =>
    status === "signed" ? "Firmado" : status === "rejected" ? "Rechazado" : "Pendiente de firma";

  const copySignLink = (url: string | null) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: "Péguelo en WhatsApp o ábralo en otra pestaña para probar." });
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1" onClick={() => setLocation("/patients")}>
              <ArrowLeft className="w-4 h-4" /> Volver a Pacientes
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Historia Clínica</h1>
            <p className="text-muted-foreground">
              Paciente: <span className="font-semibold text-foreground">{patient.name}</span> • ID: {patient.id}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportRIPS} className="gap-2">
              <FileDown className="w-4 h-4" /> Exportar RIPS
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateQuotationFromOdontogram} className="gap-2">
              <ReceiptText className="w-4 h-4" /> Crear Presupuesto
            </Button>
          </div>
        </div>

        <Tabs defaultValue="odontogram" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
            <TabsTrigger value="odontogram" className="gap-1"><ClipboardList className="w-4 h-4" /> Odontograma</TabsTrigger>
            <TabsTrigger value="periodontogram" className="gap-1"><ClipboardList className="w-4 h-4" /> Periodontograma</TabsTrigger>
            <TabsTrigger value="diagnosis" className="gap-1"><Stethoscope className="w-4 h-4" /> Diagnóstico</TabsTrigger>
            <TabsTrigger value="plan" className="gap-1"><FileText className="w-4 h-4" /> Plan</TabsTrigger>
            <TabsTrigger value="evolution" className="gap-1"><History className="w-4 h-4" /> Evolución</TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1"><Image className="w-4 h-4" /> Galería</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1"><FileText className="w-4 h-4" /> Consentimientos</TabsTrigger>
          </TabsList>

          <TabsContent value="odontogram" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Mapa Dental Interactivo</CardTitle>
                <CardDescription>Marque hallazgos y tratamientos por diente.</CardDescription>
              </CardHeader>
              <CardContent>
                <Odontogram data={(odontogramData?.data as Record<string, ToothData>) || {}} onChange={handleOdontogramChange} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periodontogram" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Periodontograma</CardTitle>
                <CardDescription>Profundidad de sondaje, BOP y movilidad por diente.</CardDescription>
              </CardHeader>
              <CardContent>
                <Periodontogram
                  data={((perioData as { data?: Record<string, PeriodontalToothData> })?.data) || {}}
                  onChange={handlePerioChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnosis" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Diagnóstico Clínico</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="min-h-[200px]" placeholder="Estado general y hallazgos..." />
                <Button onClick={() => updatePatient.mutate({ id: patientId, data: { diagnosis } }, { onSuccess: () => toast({ title: "Diagnóstico guardado" }) })}>
                  <Save className="w-4 h-4 mr-1" /> Guardar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Plan de Tratamiento</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} className="min-h-[200px]" placeholder="Pasos recomendados..." />
                <Button onClick={() => updatePatient.mutate({ id: patientId, data: { medicalHistory: treatmentPlan } }, { onSuccess: () => toast({ title: "Plan guardado" }) })}>
                  <Save className="w-4 h-4 mr-1" /> Guardar
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evolution" className="mt-6 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex gap-2">
                <Button variant={noteMode === "general" ? "default" : "outline"} size="sm" onClick={() => setNoteMode("general")}>Nota general</Button>
                <Button variant={noteMode === "soap" ? "default" : "outline"} size="sm" onClick={() => setNoteMode("soap")}>Formato SOAP</Button>
              </div>

              {noteMode === "general" ? (
                <Card>
                  <CardHeader><CardTitle>Nueva Nota de Evolución</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Hallazgos, tratamiento realizado y plan..."
                      className="min-h-[150px]"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                    />
                    <Button onClick={() => createNoteMutation.mutate(newNote)} disabled={!newNote.trim()} className="gap-2">
                      <Save className="w-4 h-4" /> Guardar
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader><CardTitle>Nota SOAP</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(["subjective", "objective", "assessment", "plan"] as const).map((field) => (
                      <div key={field}>
                        <div className="flex justify-between mb-1">
                          <label className="text-xs font-bold uppercase">{field === "subjective" ? "S - Subjetivo" : field === "objective" ? "O - Objetivo" : field === "assessment" ? "A - Análisis" : "P - Plan"}</label>
                          <Button variant="ghost" size="sm" onClick={() => startVoiceDictation(field)} className="h-6 gap-1">
                            <Mic className="w-3 h-3" /> Dictar
                          </Button>
                        </div>
                        <Textarea
                          value={soap[field]}
                          onChange={(e) => setSoap({ ...soap, [field]: e.target.value })}
                          className="min-h-[60px]"
                        />
                      </div>
                    ))}
                    <Button onClick={() => createSoapMutation.mutate()} disabled={createSoapMutation.isPending} className="gap-2">
                      <Save className="w-4 h-4" /> Guardar SOAP
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="w-full lg:w-[400px]">
              <Card>
                <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {notes?.map((note) => (
                      <div key={note.id} className="p-4 border-b">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-primary">
                            {format(new Date(note.createdAt), "dd MMM yyyy", { locale: es })}
                          </span>
                          {(note as { noteType?: string }).noteType === "soap" && <Badge variant="outline" className="text-[10px]">SOAP</Badge>}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row justify-between">
                <div>
                  <CardTitle>Galería Clínica</CardTitle>
                  <CardDescription>Fotos antes/después, evolución y radiografías.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={galleryCategory} onValueChange={setGalleryCategory}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Antes</SelectItem>
                      <SelectItem value="after">Después</SelectItem>
                      <SelectItem value="evolution">Evolución</SelectItem>
                      <SelectItem value="x-ray">Radiografía</SelectItem>
                    </SelectContent>
                  </Select>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
                    <Plus className="w-4 h-4" /> Subir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {gallery.map((item) => (
                    <div key={item.id} className="relative group border rounded-lg overflow-hidden">
                      <img src={item.imageUrl} alt={item.category} className="w-full h-32 object-cover" />
                      <Badge className="absolute top-2 left-2 text-[10px]">{item.category}</Badge>
                      <Button
                        variant="destructive" size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 text-xs"
                        onClick={() => deleteGalleryMutation.mutate(item.id)}
                      >×</Button>
                    </div>
                  ))}
                  {gallery.length === 0 && <p className="text-muted-foreground text-sm col-span-full text-center py-8">Sin imágenes</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Consentimientos Digitales</CardTitle>
                <CardDescription>
                  Si el paciente está en consultorio, use <strong>Firmar aquí</strong> en este mismo dispositivo.
                  Si está remoto, use <strong>Enviar WA</strong> o <strong>Copiar link</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Select value={consentType} onValueChange={setConsentType}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="extraccion">Extracción</SelectItem>
                      <SelectItem value="implante">Implante</SelectItem>
                      <SelectItem value="endodoncia">Endodoncia</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => createConsentMutation.mutate({ sendWhatsApp: false })} variant="outline" className="gap-1">
                    <Plus className="w-4 h-4" /> Crear
                  </Button>
                  <Button onClick={() => createConsentMutation.mutate({ sendWhatsApp: true })} className="gap-1">
                    <Send className="w-4 h-4" /> Crear y enviar WA
                  </Button>
                </div>

                {consents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay consentimientos. Cree uno arriba.</p>
                )}

                <div className="space-y-3">
                  {(consents as ConsentForm[]).map((c) => (
                    <div key={c.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div>
                          <div className="font-medium text-sm">{CONSENT_TYPE_LABELS[c.type] ?? c.type}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(c.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                            {c.signedAt && ` · Firmado ${format(new Date(c.signedAt), "dd/MM/yyyy")}`}
                          </div>
                        </div>
                        <Badge variant={c.status === "signed" ? "default" : "secondary"}>
                          {consentStatusLabel(c.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{c.content}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setViewConsent(c)}>
                          <Eye className="w-3 h-3" /> Ver
                        </Button>
                        {c.status === "pending" && (
                          <>
                            <Button size="sm" className="gap-1 h-8" onClick={() => setSignConsent(c)}>
                              <PenLine className="w-3 h-3" /> Firmar aquí
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8"
                              onClick={() => copySignLink(c.signUrl)}
                              disabled={!c.signUrl}
                            >
                              <Copy className="w-3 h-3" /> Copiar link
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8"
                              onClick={() => sendConsentMutation.mutate(c.id)}
                              disabled={sendConsentMutation.isPending}
                            >
                              <Send className="w-3 h-3" /> Enviar WA
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 h-8 text-destructive"
                              onClick={() => {
                                if (confirm("¿Eliminar este consentimiento pendiente?")) {
                                  deleteConsentMutation.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Dialog open={!!viewConsent} onOpenChange={(o) => !o && setViewConsent(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    Consentimiento — {viewConsent ? (CONSENT_TYPE_LABELS[viewConsent.type] ?? viewConsent.type) : ""}
                  </DialogTitle>
                </DialogHeader>
                {viewConsent && (
                  <div className="space-y-4">
                    <Badge variant={viewConsent.status === "signed" ? "default" : "secondary"}>
                      {consentStatusLabel(viewConsent.status)}
                    </Badge>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {viewConsent.content}
                    </div>
                    {viewConsent.status === "signed" && viewConsent.signatureData && (
                      <div>
                        <p className="text-xs font-medium mb-2">Firma del paciente:</p>
                        <img src={viewConsent.signatureData} alt="Firma" className="border rounded bg-white max-h-32" />
                      </div>
                    )}
                    {viewConsent.status === "pending" && (
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" className="gap-1" onClick={() => { setSignConsent(viewConsent); setViewConsent(null); }}>
                          <PenLine className="w-3 h-3" /> Firmar aquí
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copySignLink(viewConsent.signUrl)}>
                          <Copy className="w-3 h-3 mr-1" /> Copiar link
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => sendConsentMutation.mutate(viewConsent.id)}>
                          <Send className="w-3 h-3 mr-1" /> Enviar WA
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={!!signConsent} onOpenChange={(o) => !o && setSignConsent(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    Firma en consultorio — {signConsent ? (CONSENT_TYPE_LABELS[signConsent.type] ?? signConsent.type) : ""}
                  </DialogTitle>
                </DialogHeader>
                {signConsent && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Entregue el dispositivo al paciente <strong>{patient.name}</strong> para que firme con el dedo o el mouse.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm max-h-32 overflow-y-auto">{signConsent.content}</div>
                    <SignaturePad
                      onSave={(sig) => signInClinicMutation.mutate({ id: signConsent.id, signatureData: sig })}
                      disabled={signInClinicMutation.isPending}
                    />
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
