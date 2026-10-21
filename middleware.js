import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdmin } from './lib/admin';
import { USER_EMAIL_HEADER, USER_ID_HEADER } from './lib/userHeaders';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/rsbc-logo.jpg', '/api/favicon', '/api/apple-touch-icon'];
const SERVICE_PATHS = ['/api/drafts/import'];
// Images every page shows, the same for everyone. No session check needed, so
// they skip the round trip to Supabase's auth server.
const ASSET_PATHS = ['/rsbc-logo.jpg', '/api/favicon', '/api/apple-touch-icon'];

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

// Passes a request through unchecked, minus any user headers the browser
// tried to supply: only the verified path below may set them.
function passThrough(request) {
  const headers = new Headers(request.headers);
  headers.delete(USER_ID_HEADER);
  headers.delete(USER_EMAIL_HEADER);
  return NextResponse.next({ request: { headers } });
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
  if (SERVICE_PATHS.includes(earlyPathname) || ASSET_PATHS.includes(earlyPathname)) {
    return passThrough(request);
  }

  // Link prefetches: with middleware present, Next asks about every link on
  // the page in the background (eight on Home alone), each one a Supabase
  // auth call. Pages are static shells that hold no data (each fetches its
  // own through the API, which stays checked), and the real navigation is
  // checked as usual, so these are answered without the call. Both headers
  // can be sent by anyone, so this never applies to an API route.
  if (
    !earlyPathname.startsWith('/api') &&
    request.headers.get('x-middleware-prefetch') &&
    request.headers.get('x-nextjs-data')
  ) {
    return passThrough(request);
  }

  let response = passThrough(request);

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
          response = passThrough(request);
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

  // Forward the verified user to the route. request.headers is read only now,
  // after getUser(), so it includes any session cookie refreshed above.
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set(USER_ID_HEADER, user.id);
  forwardHeaders.set(USER_EMAIL_HEADER, user.email || '');
  const forwarded = NextResponse.next({ request: { headers: forwardHeaders } });
  response.cookies.getAll().forEach((cookie) => forwarded.cookies.set(cookie));
  response = forwarded;

  if (!isPublicPath && !request.cookies.get(ACTIVITY_COOKIE)) {
    event.waitUntil(logActivity(user, activityPath(request, isApiRoute)));
    response.cookies.set(ACTIVITY_COOKIE, '1', { maxAge: ACTIVITY_WINDOW_SECONDS, path: '/', httpOnly: true, sameSite: 'lax', secure: true });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
