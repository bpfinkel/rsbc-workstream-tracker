import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdmin } from './lib/admin';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/rsbc-logo.jpg', '/api/favicon', '/api/apple-touch-icon'];
const SERVICE_PATHS = ['/api/drafts/import'];

// Activity tracking for the Admin page's "Member Activity" section. Supabase's
// last_sign_in_at barely moves because sessions persist, so instead record a
// row whenever a signed-in member actually loads a page or fetches data. The
// cookie throttles this to one row per member per ACTIVITY_WINDOW_SECONDS.
const ACTIVITY_COOKIE = 'rsbc_active';
const ACTIVITY_WINDOW_SECONDS = 300;

function activityPath(request, isApiRoute) {
  if (!isApiRoute) return request.nextUrl.pathname;
  // API calls are made by a page; record that page rather than the endpoint.
  try {
    const referer = new URL(request.headers.get('referer') || '');
    if (referer.host === request.nextUrl.host) return referer.pathname;
  } catch (e) {}
  return request.nextUrl.pathname;
}

async function logActivity(user, path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/activity_log`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: user.id, email: user.email, path })
    });
  } catch (e) {
    // Tracking is best-effort; never let it affect the request.
  }
}

export async function middleware(request, event) {
  const { pathname: earlyPathname } = request.nextUrl;

  // Server-to-server routes (e.g. the recurring Cowork task importing draft
  // tasks) authenticate with their own shared secret, not a browser session —
  // skip the Supabase cookie check entirely rather than trying to fake a user.
  if (SERVICE_PATHS.includes(earlyPathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const isApiRoute = pathname.startsWith('/api');

  if (!user) {
    if (isPublicPath) {
      return response;
    }
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  const isAdminPath = pathname === '/admin' || pathname === '/drafts' || pathname.startsWith('/api/drafts') || pathname.startsWith('/api/documents');
  if (isAdminPath && !isAdmin(user.email)) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (!isPublicPath && !request.cookies.get(ACTIVITY_COOKIE)) {
    event.waitUntil(logActivity(user, activityPath(request, isApiRoute)));
    response.cookies.set(ACTIVITY_COOKIE, '1', { maxAge: ACTIVITY_WINDOW_SECONDS, path: '/', httpOnly: true, sameSite: 'lax', secure: true });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
