// Australian number formats. People can type spaces; we store digits only.

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

// The ATO's ABN check: take 1 off the first digit, weight each digit,
// and the total must divide evenly by 89. Catches most typos.
const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export function isValidAbn(digits: string) {
  if (!/^\d{11}$/.test(digits)) return false;
  const sum = digits
    .split("")
    .map(Number)
    .reduce((total, d, i) => total + (i === 0 ? d - 1 : d) * ABN_WEIGHTS[i], 0);
  return sum % 89 === 0;
}

// 51824753556 -> "51 824 753 556"
export function formatAbn(digits: string | null) {
  if (!digits) return "";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
}
