import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdmin } from './lib/admin';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/rsbc-logo.jpg', '/api/favicon', '/api/apple-touch-icon'];
const SERVICE_PATHS = ['/api/drafts/import'];

export async function middleware(request) {
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

  const isAdminPath = pathname === '/drafts' || pathname.startsWith('/api/drafts');
  if (isAdminPath && !isAdmin(user.email)) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
