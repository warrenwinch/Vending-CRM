"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-ui";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) return { error: "Please fill in every field." };
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };

  // The confirmation email links back to this same website.
  const origin = (await headers()).get("origin") ?? "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: { full_name: fullName },
    },
  });

  if (error) return { error: error.message };

  // Email confirmation turned off in Supabase: they're logged in already.
  if (data.session) redirect("/setup");

  // Supabase doesn't say outright that an address already has a confirmed
  // account (and sends no email); it returns a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { error: `${email} already has an account. Please log in, or use “Forgotten your password?” on the log-in page.` };
  }

  return {
    message: `Nearly there. We've emailed a confirmation link to ${email}. Open it on this device to finish signing up.`,
  };
}

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Please enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      // values.unconfirmed tells the form to offer "Send confirmation email again".
      return {
        error: "Please confirm your email first. Check your inbox (and spam) for the link we sent.",
        values: { email, unconfirmed: "yes" },
      };
    }
    return { error: "That email and password don't match. Please try again." };
  }

  redirect("/");
}

// Sends the sign-up confirmation email again, for someone whose link went missing.
export async function resendConfirmation(email: string): Promise<FormState> {
  const clean = email.trim().toLowerCase();
  if (!clean) return { error: "Please enter your email address first." };
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: clean,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    if (error.status === 429 || /rate|seconds/i.test(error.message)) {
      return { error: "A confirmation email was sent very recently. Please wait a minute, check spam, then try again." };
    }
    return { error: `Couldn't send it: ${error.message}` };
  }
  return { message: `Sent. Check ${clean} (and the spam folder) for the confirmation link.` };
}

// Emails a link to choose a new password. Always says the same thing, so
// nobody can use this page to find out which emails have accounts.
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  if (!email) return { error: "Please enter your email address." };
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  if (error && (error.status === 429 || /rate|seconds/i.test(error.message))) {
    return { error: "A reset email was sent very recently. Please wait a minute, check spam, then try again." };
  }
  return {
    message: `If ${email} has an account, we've emailed it a link to choose a new password. Open it on this device.`,
  };
}

// Saves a new password for the person who followed the reset link.
export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match. Please type them again." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "This reset link has expired. Please ask for a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `Couldn't save your new password: ${error.message}` };
  redirect("/");
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
