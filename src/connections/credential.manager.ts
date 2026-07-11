import { encrypt, decrypt } from "@/auth/encrypt";

export class CredentialManager {
  private masterKey: CryptoKey | null = null;

  async init(encodedKey: string): Promise<void> {
    let raw: Uint8Array;
    if (/^[0-9a-fA-F]{64}$/.test(encodedKey)) {
      raw = Uint8Array.from(
        encodedKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
      );
    } else {
      const binary = atob(encodedKey.replace(/-/g, "+").replace(/_/g, "/"));
      raw = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) raw[i] = binary.charCodeAt(i);
    }
    this.masterKey = await crypto.subtle.importKey(
      "raw", raw, "AES-GCM", false, ["encrypt", "decrypt"],
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
