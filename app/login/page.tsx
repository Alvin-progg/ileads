import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — I-LEADS" };

export default function LoginPage() {
  return (
    <main
      className="grid min-h-screen place-items-center p-6"
      style={{
        background:
          "radial-gradient(900px 500px at 20% 0%, rgba(5,150,105,0.08), transparent 60%)," +
          "radial-gradient(700px 400px at 90% 100%, rgba(5,150,105,0.06), transparent 60%)," +
          "#f6faf8",
      }}
    >
      <div className="fade-up w-full max-w-[380px] rounded-2xl border border-neutral-900/5 bg-white px-8 pt-8 pb-9 shadow-[0_12px_32px_rgba(6,78,59,0.10),0_2px_8px_rgba(6,78,59,0.05)]">
        <div
          aria-hidden="true"
          className="mb-4 grid h-10 w-10 place-items-center rounded-[10px] bg-emerald-600 font-bold text-white"
        >
          IL
        </div>
        <h1 className="text-[21px] font-semibold">Sign in to I-LEADS</h1>
        <p className="mb-7 text-[13px] text-neutral-500">
          Ligaya Primary School · learner records
        </p>
        <LoginForm />
        <p className="mt-5 text-center text-xs text-neutral-400">
          Accounts are issued by the school head
        </p>
      </div>
    </main>
  );
}
