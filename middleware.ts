import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";
import { logGatewayError } from "@/lib/supabase/debug-env";
import { subscriptionAllowsFullAccess } from "@/lib/subscription-access";

const protectedPrefixes = ["/dashboard", "/agenda", "/assinatura", "/suporte"];

const barberRestrictedPrefixes = ["/dashboard", "/agenda"];

function isRestrictedBarberRoute(pathname: string): boolean {
  return barberRestrictedPrefixes.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const env = getPublicSupabaseEnv();

  if (!env.ok) {
    logGatewayError("middleware.supabase_env", env.message);

    return new NextResponse(env.message, {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const { url, anonKey } = env;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  /* `/agendamento` ≠ `/agenda`, mas `startsWith("/agenda")` captura o prefixo de `/agendamento/...`. */
  if (pathname.startsWith("/agendamento")) {
    return supabaseResponse;
  }

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/api/")) {
    // Autenticação por rota: o middleware não exige sessão aqui — cada handler em `app/api/**`
    // aplica o mecanismo correto (sessão Supabase, Bearer de cron, assinatura Stripe, etc.).
    // Ver comentários no topo de cada `route.ts` correspondente.
    return supabaseResponse;
  }

  if (user && isRestrictedBarberRoute(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "barber") {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return NextResponse.redirect(home);
    }

    const billingOrSupport =
      pathname.startsWith("/assinatura") || pathname.startsWith("/suporte");
    const shopPromise = supabase
      .from("barbershops")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const subPromise = billingOrSupport
      ? Promise.resolve({ data: null as null })
      : supabase
          .from("subscriptions")
          .select("status, current_period_end, trial_end_date, account_blocked")
          .eq("user_id", user.id)
          .maybeSingle();

    const [{ data: shop }, { data: sub }] = await Promise.all([shopPromise, subPromise]);

    const bootstrapping = !shop;

    if (bootstrapping) {
      if (pathname.startsWith("/agenda")) {
        const u = request.nextUrl.clone();
        u.pathname = "/dashboard";
        return NextResponse.redirect(u);
      }
      return supabaseResponse;
    }

    if (billingOrSupport) {
      return supabaseResponse;
    }

    const access = subscriptionAllowsFullAccess(sub);
    if (!access) {
      const u = request.nextUrl.clone();
      u.pathname = "/assinatura";
      u.searchParams.set("trial_expired", "1");
      return NextResponse.redirect(u);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
