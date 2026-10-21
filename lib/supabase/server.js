import { createServerClient } from '@supabase/ssr';
import { USER_EMAIL_HEADER, USER_ID_HEADER } from '../userHeaders';

function serializeCookie(name, value, options = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  str += `; Path=${options.path || '/'}`;
  if (options.maxAge != null) str += `; Max-Age=${options.maxAge}`;
  if (options.domain) str += `; Domain=${options.domain}`;
  if (options.sameSite) str += `; SameSite=${options.sameSite}`;
  if (options.secure) str += '; Secure';
  if (options.httpOnly) str += '; HttpOnly';
  return str;
}

// The signed-in user for a Pages Router API route. middleware.js has already
// verified the session with Supabase and passes the user along in request
// headers it always overwrites, so normally this needs no network call. The
// cookie lookup below is the fallback if those headers are ever missing.
export async function getUserFromRequest(req, res) {
  const id = req.headers[USER_ID_HEADER];
  if (id) return { id, email: req.headers[USER_EMAIL_HEADER] || '' };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies || {}).map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          const existing = res.getHeader('Set-Cookie');
          const cookies = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.push(serializeCookie(name, value, options));
          });
          res.setHeader('Set-Cookie', cookies);
        }
      }
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
