import type { EventKey, Gender } from "@/types/domain";

export type LastChanceMeetName =
  | "HOKA St. Vrain Invitational"
  | "Teddy's Last Chance";

export interface LastChanceScheduleSlot {
  meetName: LastChanceMeetName;
  day: "Friday" | "Saturday";
  gender: Gender;
  event: EventKey;
  startTime: string;
  minutesFromWeekendStart: number;
  freshnessLabel: "Fresh first shot" | "Backup, less fresh";
  notes: string;
}

function minutes(day: LastChanceScheduleSlot["day"], time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return day === "Saturday" ? 24 * 60 : 0;

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  // All supplied schedule times are late morning through evening.
  if (hour < 8) hour += 12;

  return (day === "Saturday" ? 24 * 60 : 0) + hour * 60 + minute;
}

function slot(
  meetName: LastChanceMeetName,
  day: LastChanceScheduleSlot["day"],
  gender: Gender,
  event: EventKey,
  startTime: string,
  notes = "",
): LastChanceScheduleSlot {
  return {
    meetName,
    day,
    gender,
    event,
    startTime,
    minutesFromWeekendStart: minutes(day, startTime),
    freshnessLabel: day === "Friday" ? "Fresh first shot" : "Backup, less fresh",
    notes,
  };
}

export const lastChanceScheduleSlots: LastChanceScheduleSlot[] = [
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "3200m", "9:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "3200m", "9:30"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "4x200m Relay", "10:15"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "4x200m Relay", "10:45"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "100m Hurdles", "11:15"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "110m Hurdles", "11:40"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "4x800m Relay", "12:05"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "4x800m Relay", "12:35"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "100m", "1:05"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "100m", "1:35"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "400m", "2:20"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "400m", "2:50"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "800m", "3:20"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "800m", "3:50"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "300m Hurdles", "4:20"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "300m Hurdles", "4:50"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "4x100m Relay", "5:15"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "4x100m Relay", "5:35"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "200m", "6:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "200m", "6:35"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "4x400m Relay", "7:05"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "4x400m Relay", "7:30"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "1600m", "8:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "1600m", "8:35"),
  slot(
    "HOKA St. Vrain Invitational",
    "Friday",
    "Girls",
    "1600m",
    "9:15",
    "Elite section window.",
  ),
  slot(
    "HOKA St. Vrain Invitational",
    "Friday",
    "Boys",
    "1600m",
    "9:30",
    "Elite section window.",
  ),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "High Jump", "10:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "Long Jump", "10:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "Shot Put", "10:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "Triple Jump", "10:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "Discus", "10:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "Pole Vault", "10:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "High Jump", "2:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "Shot Put", "2:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "Discus", "2:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Girls", "Long Jump", "2:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "Triple Jump", "2:00"),
  slot("HOKA St. Vrain Invitational", "Friday", "Boys", "Pole Vault", "2:00"),

  slot("Teddy's Last Chance", "Saturday", "Girls", "3200m", "11:45"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "3200m", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "4x200m Relay", "12:30"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "4x200m Relay", "12:50"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "4x800m Relay", "1:10"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "4x800m Relay", "1:25"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "100m Hurdles", "1:40"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "110m Hurdles", "2:00"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "100m", "2:20"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "100m", "2:45"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "400m", "3:20"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "400m", "3:35"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "800m", "4:00"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "800m", "4:30"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "300m Hurdles", "5:00"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "300m Hurdles", "5:20"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "4x100m Relay", "5:45"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "4x100m Relay", "6:00"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "200m", "6:45"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "200m", "7:05"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "1600m", "7:40"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "1600m", "8:10"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "4x400m Relay", "8:45"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "4x400m Relay", "9:05"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "High Jump", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "Long Jump", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "Shot Put", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "Pole Vault", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "Triple Jump", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "Discus", "12:00"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "High Jump", "2:30"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "Shot Put", "3:00"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "Discus", "3:30"),
  slot("Teddy's Last Chance", "Saturday", "Girls", "Triple Jump", "3:30"),
  slot("Teddy's Last Chance", "Saturday", "Boys", "Long Jump", "3:30"),
];

export function scheduleSlotsFor(
  gender: Gender,
  event: EventKey,
): LastChanceScheduleSlot[] {
  return lastChanceScheduleSlots
    .filter((slot) => slot.gender === gender && slot.event === event)
    .sort((a, b) => a.minutesFromWeekendStart - b.minutesFromWeekendStart);
}

export function formatScheduleSlot(slot: LastChanceScheduleSlot) {
  return `${slot.meetName.replace(" Invitational", "")}, ${slot.day} ${slot.startTime}`;
}
