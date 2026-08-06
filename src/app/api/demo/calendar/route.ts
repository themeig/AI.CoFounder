import { NextResponse } from "next/server";
import { getUpcomingCalendarEvents, createGoogleCalendarEvent, isGoogleCalendarConfigured } from "@/lib/connectors/gcal";
import { hasApiKey } from "@/lib/secure-store";

/**
 * GET /api/demo/calendar
 * Returns upcoming Google Calendar events and connection status.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startupOnly = url.searchParams.get("startupOnly") === "true";
    const isConfigured = await hasApiKey("google_calendar");
    let events = await getUpcomingCalendarEvents(20);

    if (startupOnly) {
      events = events.filter(e => e.isStartup);
    }

    return NextResponse.json({
      configured: isConfigured,
      events,
      count: events.length
    });
  } catch (err: any) {
    console.error("[Calendar GET] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/calendar
 * Creates a new event or syncs today's Daily Standup meeting to Google Calendar.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.type === "sync_standup") {
      // Sync today's daily standup meeting action items to Google Calendar
      const event = await createGoogleCalendarEvent({
        summary: `🎙️ Daily Standup AI.CoFounder — ${new Date().toLocaleDateString("it-IT")}`,
        description: `Riunione di allineamento team AI.\n\nAction Items per il Founder:\n${(body.actionItems || []).map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}`,
        startIso: body.startIso || new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        durationMinutes: 30,
        location: "Google Meet",
        attendees: ["founder@startup.com"]
      });

      return NextResponse.json({
        success: true,
        message: "✓ Daily Standup sincronizzato su Google Calendar con successo!",
        event
      });
    }

    // Standard event creation
    const { summary, description, startIso, durationMinutes, location, attendees } = body;
    if (!summary || !startIso) {
      return NextResponse.json({ error: "Titolo (summary) e orario d'inizio (startIso) sono obbligatori." }, { status: 400 });
    }

    const event = await createGoogleCalendarEvent({
      summary,
      description,
      startIso,
      durationMinutes: durationMinutes || 30,
      location: location || "Google Meet",
      attendees: attendees || ["founder@startup.com"]
    });

    return NextResponse.json({
      success: true,
      message: "✓ Evento creato su Google Calendar con successo!",
      event
    });
  } catch (err: any) {
    console.error("[Calendar POST] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
