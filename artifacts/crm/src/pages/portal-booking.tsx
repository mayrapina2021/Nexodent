import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getPortalSlots, getPortalTreatments, bookPortalAppointment } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle } from "lucide-react";

export default function PortalBooking() {
  const [date, setDate] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", treatment: "", startTime: "", notes: "" });
  const [done, setDone] = useState(false);

  const { data: slots } = useQuery({
    queryKey: ["portal-slots", date],
    queryFn: () => getPortalSlots(date),
    enabled: !!date,
  });

  const { data: treatments = [] } = useQuery({ queryKey: ["portal-treatments"], queryFn: getPortalTreatments });

  const bookMutation = useMutation({
    mutationFn: bookPortalAppointment,
    onSuccess: () => setDone(true),
  });

  const handleBook = () => {
    if (!form.name || !form.phone || !form.treatment || !date || !form.startTime) return;
    bookMutation.mutate({ ...form, date });
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">¡Cita agendada!</h2>
            <p className="text-muted-foreground">Recibirá confirmación por WhatsApp. Gracias por confiar en Nexodent.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-2">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Agendar Cita Online</CardTitle>
          <CardDescription>Nexodent — Reserva tu consulta odontológica</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Teléfono / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select value={form.treatment} onValueChange={(v) => setForm({ ...form, treatment: v })}>
            <SelectTrigger><SelectValue placeholder="Tratamiento" /></SelectTrigger>
            <SelectContent>
              {treatments.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          {slots && slots.slots.length > 0 && (
            <Select value={form.startTime} onValueChange={(v) => setForm({ ...form, startTime: v })}>
              <SelectTrigger><SelectValue placeholder="Hora disponible" /></SelectTrigger>
              <SelectContent>
                {slots.slots.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Notas adicionales" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button className="w-full" onClick={handleBook} disabled={bookMutation.isPending}>
            {bookMutation.isPending ? "Agendando..." : "Confirmar cita"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
