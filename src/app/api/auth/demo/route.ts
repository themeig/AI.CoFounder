import { NextResponse } from 'next/server';
import { supabaseFetch } from '@/lib/supabase-demo';

export async function POST() {
  try {
    let users = await supabaseFetch('/User?email=eq.demo@agentfoundry.ai&select=id');
    let userId = users && Array.isArray(users) && users.length > 0 && users[0]?.id ? users[0].id : 'demo-user-id';

    let startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=id`);
    if (!startups || !Array.isArray(startups) || startups.length === 0) {
      await supabaseFetch('/Startup', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          name: 'TechFlow',
          description: 'AI-powered workflow automation for startups',
          sector: 'SaaS',
          phase: 'idea',
        }),
      });
    }

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
  } catch (err: any) {
    console.error('Demo auth fallback catch:', err?.message || err);
    const response = NextResponse.json({ ok: true, redirect: '/dashboard' });
    response.cookies.set('demo_user_id', 'demo-user-id', {
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
  }
}
