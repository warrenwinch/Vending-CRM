import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/form-ui";
import { SignupForm } from "./signup-form";

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthCard title="Create your account">
      <Suspense fallback={<SignupForm />}>
        <SignupWithEmail searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

// Invitation links include the invited email, so it's filled in already.
async function SignupWithEmail({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { email } = await searchParams;
  return <SignupForm defaultEmail={typeof email === "string" ? email.slice(0, 254) : undefined} />;
}
