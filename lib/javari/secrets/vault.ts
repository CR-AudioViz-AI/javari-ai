// auto-stub
export class SecretVault {
  async get(_key: string): Promise<string|null> { return null }
  async set(_key: string, _val: string): Promise<void> {}
}
export const vault = new SecretVault()
export default vault
export const getVaultStatus: any = (v?: any) => v ?? {}
