import { Suspense } from "react";
import { SignupConsentForm } from "@/components/signup-consent-form";

export default function SignupConsentPage() {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-16 text-center text-sm text-neutral-400">
          読み込み中...
        </p>
      }
    >
      <SignupConsentForm />
    </Suspense>
  );
}
