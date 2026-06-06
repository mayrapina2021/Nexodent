import React, { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getPortalConsent, signPortalConsent } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignaturePad } from "@/components/signature-pad";
import { CheckCircle, FileText } from "lucide-react";

export default function PortalConsent() {
  const [, params] = useRoute("/portal/consent/:token");
  const token = params?.token ?? "";
  const [signed, setSigned] = useState(false);

  type ConsentData = { form: { id: number; type: string; content: string; status: string }; patient: { name: string } };
  const { data, isLoading, error } = useQuery<ConsentData>({
    queryKey: ["portal-consent", token],
    queryFn: () => getPortalConsent(token) as Promise<ConsentData>,
    enabled: !!token,
  });

  const signMutation = useMutation({
    mutationFn: (signatureData: string) => signPortalConsent(token, signatureData),
    onSuccess: () => setSigned(true),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-red-600">Enlace inválido o expirado</div>;

  if (signed || data.form.status === "signed") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Consentimiento firmado</h2>
            <p className="text-muted-foreground">Su firma ha sido registrada correctamente. Gracias, {data.patient.name}.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            <CardTitle>Consentimiento Informado</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Paciente: {data.patient.name}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {data.form.content}
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Firme en el recuadro:</p>
            <SignaturePad onSave={(sig) => signMutation.mutate(sig)} disabled={signMutation.isPending} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
