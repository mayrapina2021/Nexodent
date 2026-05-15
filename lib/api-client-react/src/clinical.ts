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
