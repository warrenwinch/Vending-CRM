import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/form-ui";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard title="Log in">
      <Suspense fallback={<LoginForm />}>
        <LoginWithNotice searchParams={searchParams} />
      </Suspense>
      <p className="text-sm">
        <Link href="/forgot-password" className="font-bold text-brand-deep underline">
          Forgotten your password?
        </Link>
      </p>
      <p className="text-sm text-zinc-600">
        New here?{" "}
        <Link href="/signup" className="font-medium underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

// Shows a message when the email confirmation link didn't work.
async function LoginWithNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const notice =
    error === "confirm"
      ? { error: "That confirmation link didn't work. It may have expired or already been used. Try logging in, or sign up again." }
      : undefined;
  return <LoginForm notice={notice} />;
}
