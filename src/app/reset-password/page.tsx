// Reached from the link in a password-reset email (which logs the person in
// for this one purpose). Logged-out visitors are sent to log in by the proxy.
import { AuthCard } from "@/components/form-ui";
import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <ResetForm />
    </AuthCard>
  );
}
