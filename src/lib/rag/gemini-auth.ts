export const GEMINI_API_KEY_STORAGE_KEY = "zano_gemini_api_key_v1";

export function getGeminiApiKey(): string | undefined {
  const configStr = localStorage.getItem("zanosheets-web-config-v1");
  if (!configStr) return undefined;
  try {
    const config = JSON.parse(configStr);
    return config.apiKeys?.gemini;
  } catch {
    return undefined;
  }
}
