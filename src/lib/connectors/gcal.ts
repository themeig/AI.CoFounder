import { getApiKey } from "@/lib/secure-store";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  location?: string;
  attendees?: string[];
  htmlLink?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  isStartup?: boolean;
}

export function isStartupEvent(summary: string, description = ""): boolean {
  const combined = `${summary} ${description}`.toLowerCase();
  
  // Explicit tags
  if (combined.includes("#startup") || combined.includes("[startup]") || combined.includes("#work") || combined.includes("[work]")) {
    return true;
  }
  
  // Startup Emojis
  if (/[🚀💼🎙️📊🛠️💻🎯📈💵🤝🏢]/u.test(summary) || /[🚀💼🎙️📊🛠️💻🎯📈💵🤝🏢]/u.test(description)) {
    return true;
  }

  // Work & Startup Keywords
  const startupKeywords = [
    "pitch", "investor", "call", "meeting", "riunione", "demo", "sprint", 
    "standup", "review", "client", "cliente", "saas", "cofounder", "co-founder",
    "marketing", "tech", "finance", "legal", "ops", "dev", "release", "board", 
    "vc", "angel", "fundraising", "mrr", "kpi", "roadmap", "sync", "briefing", "agent", "work"
  ];

  return startupKeywords.some(kw => combined.includes(kw));
}

const DEFAULT_MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "evt-gcal-1",
    summary: "🎙️ Daily Team Standup — AI.CoFounder",
    description: "Briefing giornaliero automatico con il team di dipendenti AI ed il coFounder.",
    start: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
    location: "Google Meet",
    attendees: ["founder@startup.com", "cofounder@agentfoundry.ai"],
    status: "confirmed"
  },
  {
    id: "evt-gcal-2",
    summary: "💼 Pitch Review & Investor Call (Pre-Seed Round)",
    description: "Incontro con Business Angels per presentare le KPI ed il pitch deck di crescita.",
    start: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 60 * 27).toISOString(),
    location: "Google Meet / Remote",
    attendees: ["founder@startup.com", "angel1@venture.vc"],
    status: "confirmed"
  },
  {
    id: "evt-gcal-3",
    summary: "🚀 Review Campagne Growth & Marketing",
    description: "Sessione di verifica CAC e conversioni con il Marketing Agent.",
    start: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 60 * 49).toISOString(),
    location: "AI.CoFounder Workspace",
    attendees: ["founder@startup.com", "marketing-agent@agentfoundry.ai"],
    status: "confirmed"
  }
];

/**
 * Helper to parse iCal / ICS format feed from Google Calendar
 */
function parseICSDate(icsDateStr: string): Date | null {
  try {
    const clean = icsDateStr.replace(/[^0-9T]/g, "");
    if (clean.length >= 8) {
      const year = parseInt(clean.substring(0, 4), 10);
      const month = parseInt(clean.substring(4, 6), 10) - 1;
      const day = parseInt(clean.substring(6, 8), 10);
      let hour = 0, min = 0, sec = 0;
      if (clean.includes("T") && clean.length >= 13) {
        const timePart = clean.split("T")[1];
        hour = parseInt(timePart.substring(0, 2), 10);
        min = parseInt(timePart.substring(2, 4), 10);
        sec = parseInt(timePart.substring(4, 6) || "0", 10);
      }
      return new Date(Date.UTC(year, month, day, hour, min, sec));
    }
  } catch {}
  return null;
}

function parseICSEvents(icsText: string, maxResults = 10): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const vevents = icsText.split("BEGIN:VEVENT");
  const now = new Date();

  for (let i = 1; i < vevents.length; i++) {
    const block = vevents[i].split("END:VEVENT")[0];
    const summaryMatch = block.match(/SUMMARY:(.*)/);
    const descMatch = block.match(/DESCRIPTION:(.*)/);
    const dtstartMatch = block.match(/DTSTART(?:;[^:]+)?:(.*)/);
    const dtendMatch = block.match(/DTEND(?:;[^:]+)?:(.*)/);
    const locationMatch = block.match(/LOCATION:(.*)/);

    if (dtstartMatch) {
      const rawStart = dtstartMatch[1].trim();
      const startDate = parseICSDate(rawStart);
      const rawEnd = dtendMatch ? dtendMatch[1].trim() : rawStart;
      const endDate = parseICSDate(rawEnd);

      if (startDate && startDate >= new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
        const summary = summaryMatch ? summaryMatch[1].trim().replace(/\\,/g, ",") : "Evento Google Calendar";
        const description = descMatch ? descMatch[1].trim().replace(/\\n/g, "\n") : "";
        events.push({
          id: `ics-${i}-${startDate.getTime()}`,
          summary,
          description,
          start: startDate.toISOString(),
          end: endDate ? endDate.toISOString() : startDate.toISOString(),
          location: locationMatch ? locationMatch[1].trim() : "Google Calendar",
          status: "confirmed",
          isStartup: isStartupEvent(summary, description)
        });
      }
    }
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events.slice(0, maxResults);
}

/**
 * Check if Google Calendar API key or Client ID is configured
 */
export async function isGoogleCalendarConfigured(): Promise<boolean> {
  const gcalKey = await getApiKey("google_calendar");
  return !!gcalKey;
}

/**
 * Fetch upcoming Google Calendar events
 */
export async function getUpcomingCalendarEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const gcalKey = await getApiKey("google_calendar");

  if (!gcalKey) {
    return DEFAULT_MOCK_EVENTS;
  }

  // 1. If gcalKey is an iCal / ICS Private URL (https://calendar.google.com/calendar/ical/...)
  if (gcalKey.startsWith("http://") || gcalKey.startsWith("https://")) {
    try {
      const resIcs = await fetch(gcalKey);
      if (resIcs.ok) {
        const icsText = await resIcs.text();
        const parsedEvents = parseICSEvents(icsText, maxResults);
        if (parsedEvents.length > 0) {
          return parsedEvents;
        }
      }
    } catch (err: any) {
      console.error("[GCal Connector] Error fetching iCal URL:", err.message);
    }
  }

  // 2. Direct Google OAuth Access Token or Google API Call
  try {
    const calendarId = "primary";
    const now = new Date().toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(now)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${gcalKey}`,
        "Content-Type": "application/json"
      }
    });

    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      return items.map((item: any) => {
        const summary = item.summary || "Senza titolo";
        const description = item.description || "";
        return {
          id: item.id,
          summary,
          description,
          start: item.start?.dateTime || item.start?.date || new Date().toISOString(),
          end: item.end?.dateTime || item.end?.date || new Date().toISOString(),
          location: item.location || "Google Meet",
          attendees: (item.attendees || []).map((a: any) => a.email),
          htmlLink: item.htmlLink,
          status: item.status || "confirmed",
          isStartup: isStartupEvent(summary, description)
        };
      });
    }
  } catch (err: any) {
    console.error("[GCal Connector] Error fetching API events:", err.message);
  }

  return DEFAULT_MOCK_EVENTS;
}

/**
 * Create a new event in Google Calendar
 */
export async function createGoogleCalendarEvent(eventData: {
  summary: string;
  description?: string;
  startIso: string;
  durationMinutes?: number;
  location?: string;
  attendees?: string[];
}): Promise<CalendarEvent> {
  const gcalKey = await getApiKey("google_calendar");
  const duration = eventData.durationMinutes || 30;
  const startDate = new Date(eventData.startIso);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const newEvent: CalendarEvent = {
    id: "evt-gcal-" + Date.now(),
    summary: eventData.summary,
    description: eventData.description || "",
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    location: eventData.location || "Google Meet",
    attendees: eventData.attendees || ["founder@startup.com"],
    status: "confirmed"
  };

  if (!gcalKey || gcalKey.startsWith("http")) {
    DEFAULT_MOCK_EVENTS.unshift(newEvent);
    return newEvent;
  }

  try {
    const calendarId = "primary";
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gcalKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: eventData.summary,
        description: eventData.description,
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
        location: eventData.location,
        attendees: eventData.attendees?.map(email => ({ email }))
      })
    });

    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        summary: data.summary,
        description: data.description,
        start: data.start?.dateTime || startDate.toISOString(),
        end: data.end?.dateTime || endDate.toISOString(),
        location: data.location || "Google Meet",
        htmlLink: data.htmlLink,
        status: "confirmed"
      };
    }
  } catch (err: any) {
    console.error("[GCal Connector] Error creating API event:", err.message);
  }

  DEFAULT_MOCK_EVENTS.unshift(newEvent);
  return newEvent;
}
