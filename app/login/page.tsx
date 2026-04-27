import { Suspense } from "react";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">Yorke Flow — production & inventory</p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <LoginClient />
          </Suspense>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        After you sign in, you&apos;ll return to the overview or the page you opened.
      </p>
    </div>
  );
}
