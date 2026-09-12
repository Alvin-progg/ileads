import { getViewer } from "@/lib/viewer";
import { ChangePasswordForm } from "./change-password-form.tsx";

export const metadata = { title: "My Account — I-LEADS" };

export default async function AccountPage() {
  const viewer = await getViewer();

  return (
    <main className="mx-auto max-w-[900px] p-6">
      <h1 className="text-2xl font-bold">My Account</h1>
      <p className="mt-2 text-[13px] text-neutral-500">
        {viewer.fullName} · {viewer.role}
      </p>

      <h2 className="mt-8 mb-3 text-[15px] font-bold">Change password</h2>
      <ChangePasswordForm />
    </main>
  );
}
