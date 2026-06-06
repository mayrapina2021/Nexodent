import { customFetch } from "./custom-fetch";

// Pipeline
export interface PipelinePatient {
  id: number;
  name: string;
  phone: string;
  treatment: string | null;
  status: string;
  treatmentPrice: number | null;
  lastVisit: string | null;
  createdAt: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  patients: PipelinePatient[];
  count: number;
}

export const getPipeline = () => customFetch<{ stages: PipelineStage[]; stats: { totalPatients: number; totalValue: number; wonValue: number } }>("/api/pipeline");
export const updatePipelineStage = (patientId: number, status: string) =>
  customFetch("/api/pipeline/stage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, status }) });

// Lab
export interface LabOrder {
  id: number;
  patientId: number;
  patientName: string;
  labName: string;
  workType: string;
  status: string;
  sentDate: string;
  dueDate: string | null;
  receivedDate: string | null;
  notes: string | null;
}

export const listLabOrders = (patientId?: number) =>
  customFetch<LabOrder[]>(`/api/lab/orders${patientId ? `?patientId=${patientId}` : ""}`);
export const createLabOrder = (data: { patientId: number; labName: string; workType: string; dueDate?: string; notes?: string }) =>
  customFetch("/api/lab/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const updateLabOrder = (id: number, data: Partial<{ status: string; labName: string; workType: string; dueDate: string; notes: string }>) =>
  customFetch(`/api/lab/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

// Gallery
export interface GalleryItem {
  id: number;
  patientId: number;
  imageUrl: string;
  category: string;
  notes: string | null;
  createdAt: string;
}

export const listGallery = (patientId: number) => customFetch<GalleryItem[]>(`/api/gallery/${patientId}`);
export const createGalleryItem = (data: { patientId: number; imageUrl: string; category: string; notes?: string }) =>
  customFetch("/api/gallery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const deleteGalleryItem = (id: number) => customFetch(`/api/gallery/${id}`, { method: "DELETE" });

// Payment plans
export interface PaymentPlan {
  id: number;
  patientId: number;
  patientName: string;
  treatmentName: string;
  totalAmount: number;
  downPayment: number;
  installmentCount: number;
  installmentAmount: number;
  frequency: string;
  startDate: string;
  status: string;
  notes: string | null;
}

export interface PaymentPlanInstallment {
  id: number;
  planId: number;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: string;
  paidAt: string | null;
}

export const listPaymentPlans = (patientId?: number) =>
  customFetch<PaymentPlan[]>(`/api/payment-plans${patientId ? `?patientId=${patientId}` : ""}`);
export const getPlanInstallments = (planId: number) => customFetch<PaymentPlanInstallment[]>(`/api/payment-plans/${planId}/installments`);
export const createPaymentPlan = (data: Record<string, unknown>) =>
  customFetch("/api/payment-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const getOverdueInstallments = () => customFetch("/api/payment-plans/overdue");
export const markInstallmentPaid = (id: number, paymentId?: number) =>
  customFetch(`/api/payment-plans/installments/${id}/pay`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }) });

// Periodontogram
export interface PeriodontalSite { pd: number; bop: boolean }
export interface PeriodontalToothData { sites: PeriodontalSite[]; mobility: number; recession?: number; notes?: string }

export const getPeriodontogram = (patientId: number) => customFetch(`/api/clinical/periodontogram/${patientId}`);
export const updatePeriodontogram = (patientId: number, data: Record<string, PeriodontalToothData>) =>
  customFetch(`/api/clinical/periodontogram/${patientId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });

// Consent
export interface ConsentForm {
  id: number;
  patientId: number;
  type: string;
  content: string | null;
  status: string;
  signatureData: string | null;
  portalToken: string | null;
  signUrl: string | null;
  signedAt: string | null;
  createdAt: string;
}

export const listConsents = (patientId: number) => customFetch<ConsentForm[]>(`/api/clinical/consent/${patientId}`);
export const createConsent = (data: { patientId: number; type: string; sendWhatsApp?: boolean }) =>
  customFetch<ConsentForm & { whatsappSent?: boolean }>("/api/clinical/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const sendConsentWhatsApp = (id: number) =>
  customFetch<{ sent: boolean; signUrl: string }>(`/api/clinical/consent/${id}/send-whatsapp`, { method: "POST" });
export const signConsentInClinic = (id: number, signatureData: string) =>
  customFetch<ConsentForm>(`/api/clinical/consent/${id}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signatureData }),
  });
export const deleteConsent = (id: number) =>
  customFetch(`/api/clinical/consent/${id}`, { method: "DELETE" });

// Portal (public)
export const getPortalSlots = (date: string) => customFetch<{ date: string; slots: string[] }>(`/api/portal/available-slots?date=${date}`);
export const getPortalTreatments = () => customFetch<{ name: string; price: string }[]>("/api/portal/treatments");
export const bookPortalAppointment = (data: Record<string, unknown>) =>
  customFetch("/api/portal/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
export const getPortalConsent = (token: string) => customFetch(`/api/portal/consent/${token}`);
export const signPortalConsent = (token: string, signatureData: string) =>
  customFetch(`/api/portal/consent/${token}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureData }) });
export const getPortalQuotation = (token: string) => customFetch(`/api/portal/quotation/${token}`);
export const generatePortalLink = (data: { patientId: number; type: string; resourceId?: number }) =>
  customFetch<{ token: string; url: string }>("/api/portal/generate-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

// Marketing
export const getInactivePatients = (days = 90) => customFetch(`/api/marketing/inactive-patients?days=${days}`);
export const getMarketingStats = () => customFetch("/api/marketing/stats");
export const sendReactivation = (patientIds: number[], message?: string) =>
  customFetch("/api/marketing/reactivate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientIds, message }) });

// SOAP evolution
export const createSoapNote = (data: { patientId: number; subjective: string; objective: string; assessment: string; plan: string }) =>
  customFetch("/api/clinical/evolution", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, noteType: "soap", content: "" }) });
