export type BookingFailureReason =
  | "blocked"
  | "slot_conflict"
  | "patient_conflict"
  | "no_patient"
  | "invalid_time";

export type BookingOutcome =
  | { ok: true; appointmentId: number }
  | { ok: false; reason: BookingFailureReason };

const FAILURE_TEXT: Record<BookingFailureReason, string> = {
  blocked:
    "Para dejarla registrada en la agenda, ¿me confirmas por favor la fecha y la hora que prefieres? Con gusto te ayudo 😊",
  slot_conflict:
    "Uy, ese horario acaba de ocuparse. ¿Te gustaría otro dentro de los bloques que te mencioné?",
  patient_conflict:
    "Veo que ya tienes una cita ese día. ¿Prefieres cambiarla o elegir otra fecha?",
  no_patient:
    "Con mucho gusto te ayudo a agendar 😊 Antes, ¿me regalas tu nombre completo y el motivo de tu consulta?",
  invalid_time:
    "No logré entender bien la hora. ¿Me la confirmas así, por ejemplo: 10:00 a.m.?",
};

/** Ajusta el texto de Andrea si la cita no quedó guardada en la base de datos. */
export function amendAiMessageIfBookingFailed(message: string, outcome: BookingOutcome | null | undefined): string {
  if (!outcome || outcome.ok) return message;

  let text = message
    .replace(/\b(te he agendado|te agendé|te agende|quedó agendad[ao]|cita confirmada|he agendado tu cita)[^.!?\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const note = FAILURE_TEXT[outcome.reason];
  if (!text) return note;
  if (text.toLowerCase().includes(note.slice(0, 20).toLowerCase())) return text;
  return `${text}\n\n${note}`;
}
