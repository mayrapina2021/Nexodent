import { addMinutes, APPOINTMENT_SLOT_INTERVAL_MINUTES } from "./appointment-time";

export type SlotRange = {
  from: string;
  to: string;
  sampleStarts: string[];
};

/** Agrupa cupos consecutivos en bloques legibles (ej. 8:00–11:00). */
export function compressSlotsToRanges(slots: string[]): SlotRange[] {
  if (!slots.length) return [];

  const ranges: SlotRange[] = [];
  let blockStart = slots[0];
  let blockLast = slots[0];
  let starts = [slots[0]];

  for (let i = 1; i < slots.length; i++) {
    const expectedNext = addMinutes(blockLast, APPOINTMENT_SLOT_INTERVAL_MINUTES);
    if (slots[i] === expectedNext) {
      blockLast = slots[i];
      starts.push(slots[i]);
    } else {
      ranges.push({
        from: blockStart,
        to: addMinutes(blockLast, APPOINTMENT_SLOT_INTERVAL_MINUTES),
        sampleStarts: starts,
      });
      blockStart = slots[i];
      blockLast = slots[i];
      starts = [slots[i]];
    }
  }

  ranges.push({
    from: blockStart,
    to: addMinutes(blockLast, APPOINTMENT_SLOT_INTERVAL_MINUTES),
    sampleStarts: starts,
  });

  return ranges;
}
