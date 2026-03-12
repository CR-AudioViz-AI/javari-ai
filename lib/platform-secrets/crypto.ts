// auto-stub
export interface EncryptedEnvelope { iv: string; tag: string; ciphertext: string }
export const encryptValue = async (_v: string): Promise<EncryptedEnvelope> => ({ iv:'', tag:'', ciphertext:'' })
export const decryptValue = async (_e: EncryptedEnvelope): Promise<string> => ''
export const deriveKey = async (): Promise<Buffer> => Buffer.alloc(32)
export default {}
export const fingerprint: any = (v?: any) => v ?? {}
