import type { FirebaseOptions } from 'firebase/app';

/**
 * Configuração web do Firebase (é pública: vai para o navegador).
 * Em produção, o workflow de deploy sobrescreve este arquivo com o conteúdo da
 * variável de repositório FIREBASE_WEB_CONFIG. Com `null`, o site usa dados de exemplo.
 */
export const firebaseConfig: FirebaseOptions | null = null;
