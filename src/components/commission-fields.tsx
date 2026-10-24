"use client";

// The commission part of the client and site forms. The rate box only
// appears, and changes its label, for the chosen type. On a site form it
// can also follow the client's default ("Same as client").
import { useState } from "react";
import { Field, SelectField } from "@/components/form-ui";
import { COMMISSION_TYPES, type CommissionType } from "@/lib/location-types";

export function CommissionFields({
  title,
  type,
  rate,
  clientDefault,
}: {
  title: string;
  type: CommissionType | "client";
  rate: string;
  clientDefault?: string; // e.g. "10% of sales": shown when the site can follow its client
}) {
  const [choice, setChoice] = useState(type);
  const options = [
    ...(clientDefault !== undefined ? [{ value: "client", label: `Same as client (${clientDefault})` }] : []),
    ...COMMISSION_TYPES,
  ];

  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border-2 border-zinc-200 bg-white p-4">
      <legend className="px-1 text-sm font-bold">{title}</legend>
      <SelectField
        label="Commission"
        name="commission_type"
        options={options}
        value={choice}
        onChange={(e) => setChoice(e.target.value as CommissionType | "client")}
      />
      {(choice === "percentage" || choice === "fixed_monthly") && (
        <Field
          key={choice}
          label={choice === "percentage" ? "Rate (% of sales)" : "Amount per month ($ AUD)"}
          name="commission_rate"
          inputMode="decimal"
          placeholder={choice === "percentage" ? "10" : "150.00"}
          defaultValue={choice === type ? rate : ""}
          required
        />
      )}
    </fieldset>
  );
}
