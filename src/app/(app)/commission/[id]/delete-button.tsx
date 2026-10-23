"use client";

import { deletePayment } from "../actions";

// For payments entered by mistake. Asks first, because it can't be undone.
export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  return (
    <form
      action={deletePayment.bind(null, paymentId)}
      onSubmit={(e) => {
        if (!confirm("Delete this payment record? This can't be undone. (It doesn't change any real bank payment.)")) {
          e.preventDefault();
        }
      }}
      className="border-t border-zinc-200 pt-4"
    >
      <button type="submit" className="text-sm font-medium text-red-700 underline">
        Delete this payment record
      </button>
    </form>
  );
}
