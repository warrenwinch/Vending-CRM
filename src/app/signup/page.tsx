import Link from "next/link";
import { AuthCard } from "@/components/form-ui";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthCard title="Create your account">
      <SignupForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
