/** Mask a phone number: show first digit and last digit, rest asterisks */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "***";
  return phone[0] + "*".repeat(phone.length - 2) + phone[phone.length - 1];
}
