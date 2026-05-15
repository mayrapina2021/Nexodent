import { customFetch } from "./custom-fetch";
import type { Patient, EvolutionNote } from "./generated/api.schemas";

export interface ToothData {
  status: "healthy" | "cavity" | "filling" | "missing" | "crown" | "extraction" | "endodontics";
  surfaces: string[];
  notes?: string;
}

export interface OdontogramData {
  id?: number;
  patientId: number;
  data: Record<string, ToothData>;
  updatedAt: string;
}

/**
 * @summary Get patient by ID
 */
export const getPatient = async (id: number): Promise<Patient> => {
  return customFetch<Patient>(`/api/patients/${id}`, { method: "GET" });
};

/**
 * @summary Get odontogram for a patient
 */
export const getOdontogram = async (patientId: number): Promise<OdontogramData> => {
  return customFetch<OdontogramData>(`/api/clinical/odontogram/${patientId}`, { method: "GET" });
};

/**
 * @summary Update odontogram for a patient
 */
export const updateOdontogram = async (patientId: number, data: { data: Record<string, ToothData> }): Promise<OdontogramData> => {
  return customFetch<OdontogramData>(`/api/clinical/odontogram/${patientId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

/**
 * @summary List evolution notes for a patient
 */
export const listEvolutionNotes = async (patientId: number): Promise<EvolutionNote[]> => {
  return customFetch<EvolutionNote[]>(`/api/clinical/evolution/${patientId}`, { method: "GET" });
};

/**
 * @summary Create a new evolution note
 */
export const createEvolutionNote = async (data: { patientId: number; content: string }): Promise<EvolutionNote> => {
  return customFetch<EvolutionNote>(`/api/clinical/evolution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};
