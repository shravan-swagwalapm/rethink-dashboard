import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRole } from '@/lib/utils/auth';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/auth/callback', '/auth/confirm'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // API routes should be handled separately
  if (pathname.startsWith('/api')) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users from login to dashboard
  // But not if they just signed out (signedout query param)
  const signedOut = request.nextUrl.searchParams.get('signedout');
  if (user && pathname === '/login' && !signedOut) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect root to dashboard if authenticated, login otherwise
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = user ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  // Role-based route protection
  if (user && pathname.startsWith('/admin')) {
    // Use service role client to bypass RLS for role check
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check BOTH profiles.role AND user_role_assignments for admin access
    const [{ data: profile }, { data: roleAssignment }] = await Promise.all([
      adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(),
      adminSupabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'company_user'])
        .limit(1)
        .maybeSingle(),
    ]);

    const hasAdminAccess = (profile && isAdminRole(profile.role)) || !!roleAssignment;

    if (!hasAdminAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Mentor-only routes (correct paths: /team, /attendance, /mentor/*)
  if (user && (pathname.startsWith('/team') || pathname.startsWith('/attendance') || pathname.startsWith('/mentor/'))) {
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check BOTH profiles.role AND user_role_assignments
    const [{ data: profile }, { data: roleAssignment }] = await Promise.all([
      adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(),
      adminSupabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'company_user', 'mentor'])
        .limit(1)
        .maybeSingle(),
    ]);

    const hasMentorAccess = (profile && (isAdminRole(profile.role) || profile.role === 'mentor')) || !!roleAssignment;

    if (!hasMentorAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
