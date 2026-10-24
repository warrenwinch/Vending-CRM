import Link from "next/link";
import { AuthCard } from "@/components/form-ui";
import { ForgotForm } from "./forgot-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgotten password">
      <p className="text-zinc-600">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotForm />
      <p className="text-sm text-zinc-600">
        Remembered it?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
