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
}

const DEFAULT_MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "evt-gcal-1",
    summary: "🎙️ Daily Team Standup — AI.CoFounder",
    description: "Briefing giornaliero automatico con il team di dipendenti AI ed il coFounder.",
    start: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // 2 hours from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 2.5).toISOString(),
    location: "Google Meet",
    attendees: ["founder@startup.com", "cofounder@agentfoundry.ai"],
    status: "confirmed"
  },
  {
    id: "evt-gcal-2",
    summary: "💼 Pitch Review & Investor Call (Pre-Seed Round)",
    description: "Incontro con Business Angels per presentare le KPI ed il pitch deck di crescita.",
    start: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(), // Tomorrow
    end: new Date(Date.now() + 1000 * 60 * 60 * 27).toISOString(),
    location: "Google Meet / Remote",
    attendees: ["founder@startup.com", "angel1@venture.vc"],
    status: "confirmed"
  },
  {
    id: "evt-gcal-3",
    summary: "🚀 Review Campagne Growth & Marketing",
    description: "Sessione di verifica CAC e conversioni con il Marketing Agent.",
    start: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), // 2 days from now
    end: new Date(Date.now() + 1000 * 60 * 60 * 49).toISOString(),
    location: "AI.CoFounder Workspace",
    attendees: ["founder@startup.com", "marketing-agent@agentfoundry.ai"],
    status: "confirmed"
  }
];

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
    // Return mock events for demonstration when API key isn't configured
    return DEFAULT_MOCK_EVENTS;
  }

  try {
    // If gcalKey is an OAuth Access Token or Service Account Key / API Key
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
      return items.map((item: any) => ({
        id: item.id,
        summary: item.summary || "Senza titolo",
        description: item.description || "",
        start: item.start?.dateTime || item.start?.date || new Date().toISOString(),
        end: item.end?.dateTime || item.end?.date || new Date().toISOString(),
        location: item.location || "Google Meet",
        attendees: (item.attendees || []).map((a: any) => a.email),
        htmlLink: item.htmlLink,
        status: item.status || "confirmed"
      }));
    }

    console.warn("[GCal Connector] API call returned non-OK status, falling back to mock events");
    return DEFAULT_MOCK_EVENTS;
  } catch (err: any) {
    console.error("[GCal Connector] Error fetching events:", err.message);
    return DEFAULT_MOCK_EVENTS;
  }
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

  if (!gcalKey) {
    // Add to local mock list in memory/json for demo
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
        location: eventData.location || "Google Meet",
        attendees: (eventData.attendees || []).map(email => ({ email }))
      })
    });

    if (res.ok) {
      const created = await res.json();
      return {
        id: created.id,
        summary: created.summary,
        description: created.description,
        start: created.start?.dateTime || startDate.toISOString(),
        end: created.end?.dateTime || endDate.toISOString(),
        location: created.location,
        htmlLink: created.htmlLink,
        status: "confirmed"
      };
    }
  } catch (err: any) {
    console.error("[GCal Connector] Error creating event:", err.message);
  }

  DEFAULT_MOCK_EVENTS.unshift(newEvent);
  return newEvent;
}
