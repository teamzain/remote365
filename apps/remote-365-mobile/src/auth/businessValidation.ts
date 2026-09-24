// Client-side checks for the Business sign-up steps (the server repeats them).
export interface BusinessForm {
  companyName: string;
  businessNumber: string;
  website: string;
  country: string;
  state: string;
  city: string;
  addressLine: string;
  postalCode: string;
}

export type BusinessErrors = Partial<Record<keyof BusinessForm | 'email', string>>;

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me', 'gmx.com', 'gmx.de', 'gmx.net',
  'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com', 'zohomail.com', 'inbox.com', 'fastmail.com', 'hey.com', 'tutanota.com', 'tuta.io',
]);

export const isFreeMailDomain = (email: string) => {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return !domain || FREE_MAIL_DOMAINS.has(domain);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEBSITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const BUSINESS_NO_RE = /^[A-Za-z0-9][A-Za-z0-9 .\-\/]{2,39}$/;
const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,10}$/;

/**
 * Synchronous fallback: the two countries whose subdivisions ship in the bundle.
 * Prefer passing `hasStates` to validateAddressStep — most countries have states
 * too, they just arrive asynchronously from the geo lookup.
 */
export const needsState = (country: string) => country === 'United States' || country === 'Canada';

/** Label for a country's first-level subdivision. */
export const stateLabel = (country: string) => (country === 'Canada' ? 'Province' : 'State');

export function validateCompanyStep(form: BusinessForm): BusinessErrors {
  const errors: BusinessErrors = {};
  if (form.companyName.trim().length < 2) errors.companyName = 'Enter the registered company name.';
  if (!BUSINESS_NO_RE.test(form.businessNumber.trim())) errors.businessNumber = 'Enter the registration or tax number (3–40 letters, digits, dashes).';
  if (form.website.trim() && !WEBSITE_RE.test(form.website.trim())) errors.website = 'Enter a valid website, e.g. company.com.';
  return errors;
}

/**
 * `hasStates` says whether the geo lookup found subdivisions for this country.
 * When it did, the state is REQUIRED; when it did not (Singapore, Monaco, or a
 * failed lookup) the field is not rendered at all, so requiring it would be an
 * unfixable block. Defaults to the bundled US/Canada answer for callers that
 * validate without having run the lookup.
 */
export function validateAddressStep(form: BusinessForm, hasStates = needsState(form.country)): BusinessErrors {
  const errors: BusinessErrors = {};
  if (!form.country) errors.country = 'Select the country.';
  if (hasStates && !form.state) errors.state = `Select the ${stateLabel(form.country).toLowerCase()}.`;
  if (form.city.trim().length < 2) errors.city = 'Enter the city.';
  if (form.addressLine.trim().length < 4) errors.addressLine = 'Enter the street address.';
  if (form.postalCode.trim() && !POSTAL_RE.test(form.postalCode.trim())) errors.postalCode = 'Enter a valid postal code.';
  return errors;
}

export function validateBusinessEmail(email: string): string | undefined {
  const value = email.trim();
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address.';
  if (isFreeMailDomain(value)) return 'Use your company email address. Personal providers such as Gmail, Outlook or Yahoo are not accepted for business accounts.';
  return undefined;
}

export const validateBusiness = (form: BusinessForm): BusinessErrors => ({ ...validateCompanyStep(form), ...validateAddressStep(form) });
export const hasErrors = (errors: BusinessErrors) => Object.keys(errors).length > 0;
