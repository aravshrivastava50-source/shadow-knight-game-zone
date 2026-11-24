export const SUPPORT_CONTACT = {
  whatsappDisplay: '+91 98765 43210',
  whatsappDigits: '919876543210',
  whatsappBaseUrl: 'https://wa.me/919876543210',
  brandName: 'Shadow Knight Game Zone',
} as const;

export function sanitizeWhatsAppDigits(phoneNumber?: string): string {
  const digits = (phoneNumber ?? '').replace(/[^0-9]/g, '');
  return digits.length >= 6 ? digits : SUPPORT_CONTACT.whatsappDigits;
}

export function buildSupportWhatsAppUrl(customMessage?: string, dynamicNumber?: string): string {
  const defaultMsg =
    'Hello Shadow Knight Game Zone Team, I would like to inquire about submitting an original game for legal review and publishing.';
  const digits = sanitizeWhatsAppDigits(dynamicNumber);
  return `https://wa.me/${digits}?text=${encodeURIComponent(customMessage ?? defaultMsg)}`;
}
