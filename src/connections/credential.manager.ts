import { encrypt, decrypt } from "@/auth/encrypt";

export class CredentialManager {
  private masterKey: CryptoKey | null = null;

  async init(masterKeyHex: string): Promise<void> {
    const raw = Uint8Array.from(
      masterKeyHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
    );
    this.masterKey = await crypto.subtle.importKey(
      "raw",
      raw,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"],
    );
  }

  async initWithKey(key: CryptoKey): Promise<void> {
    this.masterKey = key;
  }

  async encryptCredentials(credentials: Record<string, string>): Promise<string> {
    if (!this.masterKey) throw new Error("CredentialManager not initialized");
    const plaintext = JSON.stringify(credentials);
    return encrypt(plaintext, this.masterKey);
  }

  async decryptCredentials(encrypted: string): Promise<Record<string, string>> {
    if (!this.masterKey) throw new Error("CredentialManager not initialized");
    const plaintext = await decrypt(encrypted, this.masterKey);
    return JSON.parse(plaintext) as Record<string, string>;
  }

  isReady(): boolean {
    return this.masterKey !== null;
  }
}
