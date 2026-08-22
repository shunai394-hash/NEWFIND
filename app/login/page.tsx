import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-center text-sm text-neutral-400">読み込み中...</p>}>
      <AuthForm />
    </Suspense>
  );
}
