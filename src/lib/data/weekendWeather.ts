import type { LastChanceMeetName } from "@/lib/data/lastChanceSchedules";

export interface WeekendWeatherWindow {
  label: string;
  timeRange: string;
  temperatureLabel: string;
  windLabel: string;
  precipLabel: string;
  trackBias: "favorable" | "watch" | "caution";
  note: string;
}

export interface WeekendWeatherOutlook {
  meetName: LastChanceMeetName;
  day: "Friday" | "Saturday";
  dateLabel: string;
  venueLabel: string;
  sourceLabel: string;
  sourceUrl: string;
  summary: string;
  coachBias: string;
  windows: WeekendWeatherWindow[];
}

export const weekendWeatherOutlooks: WeekendWeatherOutlook[] = [
  {
    meetName: "HOKA St. Vrain Invitational",
    day: "Friday",
    dateLabel: "Friday, May 8",
    venueLabel: "Longmont, CO",
    sourceLabel: "NWS hourly forecast pulled May 3",
    sourceUrl: "https://api.weather.gov/gridpoints/BOU/61,81/forecast/hourly",
    summary:
      "Sunny and low-risk: about 57 F at 9 AM, near 69 F at noon, mid-70s through the afternoon, and low rain risk.",
    coachBias:
      "Weather favors using Friday as the fresh primary attempt, especially for 3200, 800, 1600, and precise relay handoffs.",
    windows: [
      {
        label: "Morning distance",
        timeRange: "9:00-10:00",
        temperatureLabel: "57-61 F",
        windLabel: "5 mph ENE",
        precipLabel: "1%",
        trackBias: "favorable",
        note: "Good 3200 window: cool enough to race hard, with very low rain risk.",
      },
      {
        label: "Midday relays/fields",
        timeRange: "12:00-2:00",
        temperatureLabel: "69-73 F",
        windLabel: "7 mph ENE",
        precipLabel: "13%",
        trackBias: "favorable",
        note: "Warm but stable. Good for jumps, throws, and relays if wind stays light.",
      },
      {
        label: "Evening 1600/4x4",
        timeRange: "7:00-9:00",
        temperatureLabel: "62-70 F",
        windLabel: "3-6 mph N/NW",
        precipLabel: "7%",
        trackBias: "favorable",
        note: "Strong late-distance window. This is why Friday remains the preferred first shot.",
      },
    ],
  },
  {
    meetName: "Teddy's Last Chance",
    day: "Saturday",
    dateLabel: "Saturday, May 9",
    venueLabel: "Roosevelt HS, Johnstown, CO",
    sourceLabel: "NWS hourly forecast pulled May 3",
    sourceUrl: "https://api.weather.gov/gridpoints/BOU/68,88/forecast/hourly",
    summary:
      "Warmer with more volatility: upper 50s by 9 AM, mid/high 70s after noon, 19-23% thunderstorm chance from midday through evening.",
    coachBias:
      "Teddy's is a useful backup, but the model discounts second-day distance attempts and late relays because heat, wind, and storm risk are higher.",
    windows: [
      {
        label: "Late morning 3200",
        timeRange: "11:45-12:00",
        temperatureLabel: "70-74 F",
        windLabel: "7 mph SE",
        precipLabel: "23%",
        trackBias: "watch",
        note: "Raceable, but warmer than Friday. Do not plan this as a second 3200 after St. Vrain.",
      },
      {
        label: "Afternoon sprints/800",
        timeRange: "2:00-5:30",
        temperatureLabel: "79 F",
        windLabel: "8-12 mph SW/W",
        precipLabel: "23%",
        trackBias: "watch",
        note: "Good backup for sprints and some fields if weather holds. For distance, use only for priority misses.",
      },
      {
        label: "Evening 1600/4x4",
        timeRange: "7:00-9:05",
        temperatureLabel: "64-72 F",
        windLabel: "7-10 mph S/SE",
        precipLabel: "19%",
        trackBias: "caution",
        note: "Still viable, but less certain than Friday because storm risk remains into the late schedule.",
      },
    ],
  },
];

export function weatherOutlookForMeet(meetName: LastChanceMeetName) {
  return weekendWeatherOutlooks.find((outlook) => outlook.meetName === meetName);
}

export function weatherNoteForMeet(meetName: LastChanceMeetName) {
  return weatherOutlookForMeet(meetName)?.coachBias;
}

export function weatherNoteForSlotLabel(label?: string) {
  if (!label) return undefined;
  if (label.includes("St. Vrain")) {
    return weatherNoteForMeet("HOKA St. Vrain Invitational");
  }
  if (label.includes("Teddy")) {
    return weatherNoteForMeet("Teddy's Last Chance");
  }
  return undefined;
}

export function weatherPlanNotes() {
  return weekendWeatherOutlooks.map(
    (outlook) =>
      `${outlook.meetName} weather (${outlook.venueLabel}, ${outlook.dateLabel}): ${outlook.coachBias}`,
  );
}
