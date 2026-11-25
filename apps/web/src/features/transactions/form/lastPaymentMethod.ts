const LAST_METHOD_KEY = "kori.lastPaymentMethod";

export function rememberedMethod(): string {
  try {
    return localStorage.getItem(LAST_METHOD_KEY) ?? "";
  } catch (e) {
    console.warn("Couldn't read the last payment method", e);
    return "";
  }
}

export function rememberMethod(id: string) {
  try {
    localStorage.setItem(LAST_METHOD_KEY, id);
  } catch (e) {
    // Storage can be blocked (private mode); saving must still work, so only warn.
    console.warn("Couldn't remember the payment method", e);
  }
}
