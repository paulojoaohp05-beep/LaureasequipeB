// ignoreUndefinedProperties: campos ausentes (undefined) são ignorados pelo Firestore
// em vez de derrubarem a gravação — essencial para auditorias com `antes` opcional.
export const FIRESTORE_SETTINGS = { ignoreUndefinedProperties: true } as const;
