import { NextResponse } from "next/server";
import {
  getUpcomingCalendarEvents,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  isGoogleCalendarConfigured
} from "@/lib/connectors/gcal";
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

/**
 * PUT /api/demo/calendar
 * Modifies an existing event in Google Calendar.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { eventId, summary, description, startIso, durationMinutes, location } = body;

    if (!eventId) {
      return NextResponse.json({ error: "L'ID o il titolo dell'evento (eventId) è obbligatorio." }, { status: 400 });
    }

    const updated = await updateGoogleCalendarEvent(eventId, {
      summary,
      description,
      startIso,
      durationMinutes,
      location
    });

    if (!updated) {
      return NextResponse.json({ error: `Impossibile trovare l'evento '${eventId}'.` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "✓ Evento modificato con successo su Google Calendar!",
      event: updated
    });
  } catch (err: any) {
    console.error("[Calendar PUT] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/calendar
 * Deletes an event from Google Calendar.
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "Parametro eventId obbligatorio." }, { status: 400 });
    }

    const deleted = await deleteGoogleCalendarEvent(eventId);
    return NextResponse.json({
      success: deleted,
      message: deleted ? `✓ Evento '${eventId}' eliminato da Google Calendar!` : `Impossibile eliminare l'evento '${eventId}'.`
    });
  } catch (err: any) {
    console.error("[Calendar DELETE] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
