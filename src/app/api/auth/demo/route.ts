import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: 'Supabase non configurato' }, { status: 500 });
    }

    const headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    // 1. Check if demo user exists
    const userCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.demo@agentfoundry.ai&select=id`,
      { headers }
    );
    const existingUsers = await userCheck.json();

    let userId;

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      const createUser = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: 'demo@agentfoundry.ai',
          name: 'Demo Founder',
          password_hash: 'demo-not-real',
        }),
      });
      const newUsers = await createUser.json();
      userId = Array.isArray(newUsers) ? newUsers[0]?.id : newUsers?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Impossibile creare utente demo' }, { status: 500 });
    }

    // 2. Check if demo startup exists
    const startupCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/startups?owner_id=eq.${userId}&select=id`,
      { headers }
    );
    const existingStartups = await startupCheck.json();

    if (!existingStartups || existingStartups.length === 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/startups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          owner_id: userId,
          name: 'TechFlow',
          description: 'AI-powered workflow automation for startups',
          stage: 'idea',
          sector: 'SaaS',
        }),
      });
    }

    // 3. Set session cookie
    const response = NextResponse.json({ ok: true, redirect: '/dashboard' });
    response.cookies.set('demo_user_id', userId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    response.cookies.set('demo_mode', 'true', {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Demo setup error:', err);
    return NextResponse.json(
      { error: 'Errore interno: ' + (err?.message || 'sconosciuto') },
      { status: 500 }
    );
  }
}
