// Chave do site no reCAPTCHA v3, usada pelo App Check do Firebase para provar que as leituras
// do Firestore vêm deste site. É pública por natureza (vai no código de qualquer site que usa
// reCAPTCHA); a chave secreta fica só no console do Firebase. null = App Check desligado.
export const appCheckSiteKey: string | null = null;
