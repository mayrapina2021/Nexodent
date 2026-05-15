import Layout from "@/components/layout";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, BookOpen, Upload, Settings2, FlaskConical,
  Plus, Trash2, Pencil, Save, Send, Bot, User, RefreshCw,
  ChevronDown, ChevronUp, FileText, CheckCircle, AlertTriangle,
  Sparkles, MessageSquare, Target, Volume2, Zap,
} from "lucide-react";
import { getAuthToken } from "@/lib/auth-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { customFetch } from "@workspace/api-client-react";

const api = async <T = any>(path: string, opts?: any): Promise<T> => {
  return customFetch<T>(`/api${path}`, opts);
};

// ─── Tipos ─────────────────────────────────────────────────────────────────

type KnowledgeEntry = {
  id: number; title: string; content: string;
  category: string; source: string; active: boolean;
  createdAt: string; updatedAt: string;
};

type Personality = {
  id: number; name: string; role: string; mainGoal: string;
  tone: string; language: string;
  dontRepeatGreeting: boolean; proactiveQuestions: boolean;
  suggestAppointments: boolean; maxResponseLength: string;
  escalateKeywords: string; extraInstructions: string | null;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

// ─── Categorías disponibles ─────────────────────────────────────────────────

const CATEGORIES = [
  { value: "general", label: "General", color: "bg-gray-500/20 text-gray-300" },
  { value: "servicios", label: "Servicios", color: "bg-blue-500/20 text-blue-300" },
  { value: "precios", label: "Precios y tarifas", color: "bg-green-500/20 text-green-300" },
  { value: "proceso", label: "Proceso / Pasos", color: "bg-purple-500/20 text-purple-300" },
  { value: "ubicacion", label: "Ubicación / Horarios", color: "bg-orange-500/20 text-orange-300" },
  { value: "faq", label: "Preguntas frecuentes", color: "bg-cyan-500/20 text-cyan-300" },
  { value: "politicas", label: "Políticas / Garantías", color: "bg-yellow-500/20 text-yellow-300" },
  { value: "equipo", label: "Equipo médico", color: "bg-pink-500/20 text-pink-300" },
];

const catColor = (cat: string) => CATEGORIES.find(c => c.value === cat)?.color ?? "bg-muted text-muted-foreground";
const catLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label ?? cat;

// ─── Componente principal ─────────────────────────────────────────────────

export default function AITraining() {
  const [tab, setTab] = useState("knowledge");
  const { toast } = useToast();
  const qc = useQueryClient();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-accent/15 border border-accent/30">
            <Brain className="h-7 w-7 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Entrenamiento de IA</h1>
            <p className="text-muted-foreground mt-0.5">Configura el conocimiento y la personalidad de tu asistente virtual</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-card border border-border grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="knowledge" className="gap-2 data-[state=active]:bg-accent/20">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Conocimiento</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2 data-[state=active]:bg-accent/20">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Documento</span>
            </TabsTrigger>
            <TabsTrigger value="personality" className="gap-2 data-[state=active]:bg-accent/20">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Personalidad</span>
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-2 data-[state=active]:bg-accent/20">
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Probar IA</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge">
            <KnowledgeTab toast={toast} qc={qc} />
          </TabsContent>
          <TabsContent value="upload">
            <UploadTab toast={toast} qc={qc} />
          </TabsContent>
          <TabsContent value="personality">
            <PersonalityTab toast={toast} />
          </TabsContent>
          <TabsContent value="test">
            <TestTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// ─── Tab 1: Base de Conocimiento ───────────────────────────────────────────

function KnowledgeTab({ toast, qc }: { toast: any; qc: any }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [form, setForm] = useState({ title: "", content: "", category: "general", active: true });

  const { data: entries = [], isLoading } = useQuery<KnowledgeEntry[]>({
    queryKey: ["ai-knowledge"],
    queryFn: () => api("/ai-training/knowledge"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingEntry
      ? api(`/ai-training/knowledge/${editingEntry.id}`, { method: "PUT", body: JSON.stringify(data) })
      : api("/ai-training/knowledge", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: editingEntry ? "Entrada actualizada" : "Entrada creada correctamente" });
      qc.invalidateQueries({ queryKey: ["ai-knowledge"] });
      setDialogOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "Error al guardar" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/ai-training/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "Entrada eliminada" }); qc.invalidateQueries({ queryKey: ["ai-knowledge"] }); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api(`/ai-training/knowledge/${id}`, { method: "PUT", body: JSON.stringify({ active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-knowledge"] }),
  });

  const openCreate = () => {
    setForm({ title: "", content: "", category: "general", active: true });
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const openEdit = (e: KnowledgeEntry) => {
    setForm({ title: e.title, content: e.content, category: e.category, active: e.active });
    setEditingEntry(e);
    setDialogOpen(true);
  };

  const filtered = filterCat === "all" ? entries : entries.filter(e => e.category === filterCat);
  const grouped = filtered.reduce<Record<string, KnowledgeEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-52 bg-card border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías ({entries.length})</SelectItem>
              {CATEGORIES.map(c => {
                const count = entries.filter(e => e.category === c.value).length;
                return count > 0 ? <SelectItem key={c.value} value={c.value}>{c.label} ({count})</SelectItem> : null;
              })}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {entries.filter(e => e.active).length} activas · {entries.filter(e => !e.active).length} inactivas
          </span>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Agregar entrada
        </Button>
      </div>

      {/* Tarjeta de instrucción */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-4 flex gap-3">
          <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            La IA usará toda esta información para responder con precisión. Entre más detallada sea la base de conocimiento,
            mejores serán las respuestas. Organiza por categorías para que la IA entienda mejor el contexto.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Base de conocimiento vacía</p>
          <p className="text-sm mt-1">Agrega información sobre la clínica, servicios, precios, etc.</p>
          <Button onClick={openCreate} className="mt-4 bg-primary">
            <Plus className="h-4 w-4 mr-2" />
            Agregar primera entrada
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${catColor(cat)} border-0`}>{catLabel(cat)}</Badge>
                <span className="text-xs text-muted-foreground">{items.length} entradas</span>
              </div>
              <div className="space-y-2">
                {items.map(entry => (
                  <Card
                    key={entry.id}
                    className={cn(
                      "border-border/50 transition-colors",
                      entry.active ? "bg-card/80" : "bg-card/30 opacity-60"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                              className="flex items-center gap-1.5 hover:text-accent transition-colors"
                            >
                              <span className="font-semibold text-sm text-foreground">{entry.title}</span>
                              {expandedId === entry.id
                                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                            {entry.source === "upload" && (
                              <Badge className="bg-blue-500/20 text-blue-300 text-xs border-0">📄 Documento</Badge>
                            )}
                          </div>

                          <AnimatePresence>
                            {expandedId === entry.id ? (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans mt-2 p-3 bg-background/50 rounded-lg border border-border/30 max-h-48 overflow-y-auto">
                                  {entry.content}
                                </pre>
                              </motion.div>
                            ) : (
                              <p className="text-xs text-muted-foreground line-clamp-2">{entry.content}</p>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch
                            checked={entry.active}
                            onCheckedChange={v => toggleActive.mutate({ id: entry.id, active: v })}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteMutation.mutate(entry.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              {editingEntry ? "Editar entrada" : "Nueva entrada de conocimiento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="bg-background"
                  placeholder="Ej: Precio de implantes"
                />
              </div>
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Contenido *</Label>
              <Textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                className="bg-background font-mono text-sm"
                rows={10}
                placeholder={`Escribe aquí toda la información relevante...\n\nPor ejemplo:\n"El tratamiento de implantes dentales en nuestra clínica tiene un costo desde $4.500.000 COP por unidad. Incluye la consulta de valoración gratuita, la cirugía de implante y la corona definitiva. El tiempo de tratamiento es de 3 a 6 meses dependiendo del proceso de osteointegración."`}
              />
              <p className="text-xs text-muted-foreground">{form.content.length} caracteres</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label>Activa (la IA la usará en sus respuestas)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.title || !form.content}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingEntry ? "Guardar cambios" : "Agregar a la base de conocimiento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: Subir Documento ─────────────────────────────────────────────────

function UploadTab({ toast, qc }: { toast: any; qc: any }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [result, setResult] = useState<{ created: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (data: { filename: string; content: string; category: string }) =>
      api("/ai-training/upload", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setResult(data);
      toast({ title: `${data.created} bloque(s) de conocimiento creados del documento` });
      qc.invalidateQueries({ queryKey: ["ai-knowledge"] });
    },
    onError: () => toast({ variant: "destructive", title: "Error procesando el documento" }),
  });

  const readFile = (f: File) => {
    if (!f.name.match(/\.(txt|md|csv)$/i)) {
      toast({ variant: "destructive", title: "Solo se aceptan archivos .txt, .md o .csv" });
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setContent(e.target?.result as string ?? "");
    reader.readAsText(f, "UTF-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  };

  const handleProcess = () => {
    if (!file || !content) return;
    uploadMutation.mutate({ filename: file.name, content, category });
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-4 flex gap-3">
          <FileText className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Sube cualquier documento de texto</strong> con información de la clínica y la IA lo aprenderá automáticamente.</p>
            <p>Formatos aceptados: <code className="text-accent">.txt</code>, <code className="text-accent">.md</code>. El sistema divide documentos largos en bloques para un mejor aprendizaje.</p>
          </div>
        </CardContent>
      </Card>

      {/* Zona de arrastrar */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200",
          dragging ? "border-accent bg-accent/10 scale-[1.01]" : "border-border hover:border-accent/50 hover:bg-accent/5"
        )}
      >
        <input ref={fileRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
        <Upload className={cn("h-10 w-10 mx-auto mb-4", dragging ? "text-accent" : "text-muted-foreground")} />
        <p className="font-semibold text-foreground">{dragging ? "Suelta el archivo aquí" : "Arrastra un documento o haz clic para seleccionar"}</p>
        <p className="text-sm text-muted-foreground mt-1">Archivos .txt, .md hasta cualquier tamaño</p>
      </div>

      {/* Vista previa */}
      {file && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <FileText className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · {content.length} caracteres</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Categoría del contenido</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Vista previa del contenido</Label>
                <div className="bg-background rounded-lg p-3 border border-border/30 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{content.slice(0, 1500)}{content.length > 1500 ? "\n\n[... truncado para vista previa ...]" : ""}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {result ? (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <div>
                  <p className="font-semibold text-green-300">¡Documento procesado correctamente!</p>
                  <p className="text-sm text-muted-foreground">Se crearon {result.created} bloque(s) de conocimiento. La IA ya puede usar esta información.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={handleProcess} disabled={uploadMutation.isPending} className="bg-accent hover:bg-accent/90 text-accent-foreground w-full h-12 text-base">
              {uploadMutation.isPending ? (
                <><RefreshCw className="h-5 w-5 mr-2 animate-spin" />Procesando documento...</>
              ) : (
                <><Brain className="h-5 w-5 mr-2" />Entrenar IA con este documento</>
              )}
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── Tab 3: Personalidad de la IA ─────────────────────────────────────────

function PersonalityTab({ toast }: { toast: any }) {
  const [form, setForm] = useState<Partial<Personality>>({});
  const [loaded, setLoaded] = useState(false);

  const { data: personality, isLoading } = useQuery<Personality>({
    queryKey: ["ai-personality"],
    queryFn: () => api("/ai-training/personality"),
  });

  useEffect(() => {
    if (personality && !loaded) { setForm(personality); setLoaded(true); }
  }, [personality, loaded]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api("/ai-training/personality", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => toast({ title: "Personalidad actualizada · La IA aplicará los cambios en los próximos mensajes" }),
    onError: () => toast({ variant: "destructive", title: "Error al guardar la personalidad" }),
  });

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-accent" />
            Identidad del asistente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nombre del asistente</Label>
              <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-background" placeholder="Ej: Valentina" />
            </div>
            <div className="space-y-1">
              <Label>Idioma y variante</Label>
              <Input value={form.language ?? ""} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="bg-background" placeholder="Ej: español colombiano" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Rol / Descripción del asistente</Label>
            <Textarea value={form.role ?? ""} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="bg-background" rows={2} placeholder="Ej: Asistente virtual de Nexodent, clínica especializada en gestión dental inteligente" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-accent" />
            Objetivo y tono
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Objetivo principal</Label>
            <Textarea value={form.mainGoal ?? ""} onChange={e => setForm(f => ({ ...f, mainGoal: e.target.value }))} className="bg-background" rows={2} placeholder="Ej: Informar sobre tratamientos dentales, resolver dudas y agendar citas de valoración gratuita" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tono y personalidad</Label>
              <Input value={form.tone ?? ""} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} className="bg-background" placeholder="Ej: profesional, cálida, empática" />
              <p className="text-xs text-muted-foreground">Describe cómo debe sonar la IA</p>
            </div>
            <div className="space-y-1">
              <Label>Longitud de respuestas</Label>
              <Select value={form.maxResponseLength ?? "corta"} onValueChange={v => setForm(f => ({ ...f, maxResponseLength: v }))}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corta">Corta (máx. 3 oraciones) — recomendado</SelectItem>
                  <SelectItem value="media">Media (3-5 oraciones)</SelectItem>
                  <SelectItem value="larga">Larga (detallada cuando se requiera)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-accent" />
            Comportamiento inteligente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "dontRepeatGreeting", label: "No repetir saludo", desc: "Si ya saludó al paciente, continúa la conversación sin volver a saludar" },
            { key: "proactiveQuestions", label: "Preguntas proactivas", desc: "La IA hace preguntas para entender mejor las necesidades del paciente" },
            { key: "suggestAppointments", label: "Sugerir citas", desc: "Invita naturalmente al paciente a agendar una valoración o cita" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-background/50 border border-border/30">
              <div>
                <p className="font-medium text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Switch
                checked={(form as any)[key] ?? true}
                onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Escalamiento a agente humano
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Palabras clave que activan escalamiento</Label>
            <Input
              value={form.escalateKeywords ?? ""}
              onChange={e => setForm(f => ({ ...f, escalateKeywords: e.target.value }))}
              className="bg-background"
              placeholder="emergencia, urgencia, dolor fuerte, accidente"
            />
            <p className="text-xs text-muted-foreground">Separadas por comas. Si el paciente menciona alguna, la IA alertará que alguien del equipo lo contactará.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Volume2 className="h-4 w-4 text-accent" />
            Instrucciones adicionales (avanzado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.extraInstructions ?? ""}
            onChange={e => setForm(f => ({ ...f, extraInstructions: e.target.value }))}
            className="bg-background font-mono text-sm"
            rows={5}
            placeholder={`Instrucciones específicas para la IA...\n\nEjemplo:\n- Cuando pregunten por WhatsApp, decirles que pueden escribir directamente a este chat\n- Si preguntan por financiación, mencionar que ofrecemos cuotas sin intereses con tarjeta\n- No mencionar competidores ni comparar precios con otras clínicas\n- Siempre mencionar la garantía de 5 años en implantes`}
          />
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="bg-accent hover:bg-accent/90 text-accent-foreground w-full h-12 text-base"
      >
        <Save className="h-5 w-5 mr-2" />
        {saveMutation.isPending ? "Guardando personalidad..." : "Guardar personalidad de la IA"}
      </Button>
    </div>
  );
}

// ─── Tab 4: Probar la IA ─────────────────────────────────────────────────────

function TestTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const { response } = await api("/ai-training/test", {
        method: "POST",
        body: JSON.stringify({
          message: userMsg.content,
          history: messages.slice(-14),
          patientName: patientName || undefined,
        }),
      });
      setMessages(m => [...m, { role: "assistant", content: response }]);
    } catch {
      toast({ variant: "destructive", title: "Error al contactar la IA" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setMessages([]);

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-4 flex gap-3">
          <FlaskConical className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Prueba cómo responde la IA usando toda la base de conocimiento y personalidad configuradas. 
            Simula ser un paciente real para verificar las respuestas antes de activarla en WhatsApp.
          </p>
        </CardContent>
      </Card>

      {/* Config del paciente de prueba */}
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Nombre del paciente (opcional)</Label>
          <Input
            value={patientName}
            onChange={e => setPatientName(e.target.value)}
            placeholder="Ej: Carlos Rodríguez"
            className="bg-card border-border h-9"
          />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={reset} disabled={!messages.length} className="h-9">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Nueva conversación
          </Button>
        </div>
      </div>

      {/* Chat */}
      <Card className="border-border/50 bg-card/80">
        <div className="h-[420px] overflow-y-auto p-4 space-y-4">
          {!messages.length ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20">
                <Bot className="h-10 w-10 text-accent" />
              </div>
              <p className="text-sm text-center">
                Escribe un mensaje como si fueras un paciente.<br />
                La IA responderá usando tu base de conocimiento configurada.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Hola, ¿cuánto cuestan los implantes?",
                  "¿Tienen financiación?",
                  "Quiero agendar una cita",
                  "¿Dónde están ubicados?",
                ].map(s => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); }}
                    className="text-xs px-3 py-1.5 rounded-full bg-background border border-border hover:border-accent/50 hover:text-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-accent" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-sm rounded-2xl px-4 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border/60 text-foreground rounded-tl-sm"
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
              {loading && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-accent" />
                  </div>
                  <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} className="w-2 h-2 rounded-full bg-accent" animate={{ y: [0, -6, 0] }} transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.6 }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
        <div className="p-3 border-t border-border/50 flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Escribe como si fueras un paciente..."
            className="bg-background border-border"
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={!input.trim() || loading} className="bg-accent hover:bg-accent/90 text-accent-foreground px-4">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        <MessageSquare className="h-3.5 w-3.5 inline mr-1" />
        Esta sesión de prueba no se guarda en conversaciones reales. Úsala para ajustar el comportamiento antes de conectar WhatsApp.
      </p>
    </div>
  );
}
