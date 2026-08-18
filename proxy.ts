import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const roleHome: Record<string, string> = {
  head: "/admin",
  teacher: "/my-class",
};

export async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user) {
    if (pathname === "/login") return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const home = roleHome[profile?.role ?? ""] ?? "/login";

  if (pathname === "/" || pathname === "/login") {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // teachers cannot enter /admin; head can go anywhere
  if (profile?.role === "teacher" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/my-class", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
