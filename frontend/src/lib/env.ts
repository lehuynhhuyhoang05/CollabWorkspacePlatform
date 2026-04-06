const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!apiBaseUrl) {
  // This message appears clearly in dev tools when .env is missing.
  throw new Error("Missing VITE_API_BASE_URL. Create frontend/.env first.");
}

export const env = {
  apiBaseUrl,
};
