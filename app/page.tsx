import { redirect } from "next/navigation";

// The proxy redirects "/" by role before this renders; fallback for safety.
export default function Home() {
  redirect("/login");
}
