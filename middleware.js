import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  try {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isLoginPage = pathname === '/login';
    const isApiRoute = pathname.startsWith('/api');

    response.headers.set('x-mw-ran', 'yes');
    response.headers.set('x-mw-has-user', user ? 'yes' : 'no');
    response.headers.set('x-mw-user-error', userError ? String(userError.message).slice(0, 80) : 'none');
    response.headers.set('x-mw-has-url-env', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'yes' : 'no');
    response.headers.set('x-mw-has-key-env', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'yes' : 'no');

    if (!user && !isLoginPage) {
      if (isApiRoute) {
        const blocked = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        blocked.headers.set('x-mw-ran', 'yes');
        return blocked;
      }
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const redirected = NextResponse.redirect(url);
      redirected.headers.set('x-mw-ran', 'yes');
      redirected.headers.set('x-mw-redirected', 'yes');
      return redirected;
    }

    if (user && isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      const redirected = NextResponse.redirect(url);
      redirected.headers.set('x-mw-ran', 'yes');
      return redirected;
    }

    return response;
  } catch (err) {
    response.headers.set('x-mw-ran', 'error');
    response.headers.set('x-mw-error', String(err && err.message ? err.message : err).slice(0, 150));
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
