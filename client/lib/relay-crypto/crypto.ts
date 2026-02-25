/**
 * Key exchange and channel encryption. Web Crypto API.
 * ECDH P-256; HKDF for AES key; AES-GCM for transport.
 */

const ECDH_CURVE = "P-256";
const HKDF_SALT = new Uint8Array(32);
const AES_KEY_LENGTH = 256;
const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 128;

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: ECDH_CURVE },
    true,
    ["deriveBits"]
  ) as Promise<CryptoKeyPair>;
}

export async function exportPublicKeyBase64(
  publicKey: CryptoKey
): Promise<string> {
  const buf = await crypto.subtle.exportKey("spki", publicKey);
  return arrayBufferToBase64(buf);
}

export async function importPublicKeyBase64(
  base64: string
): Promise<CryptoKey> {
  const buf = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    "spki",
    buf,
    { name: "ECDH", namedCurve: ECDH_CURVE },
    true,
    []
  );
}

export async function deriveSharedSecret(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    256
  );
}

export async function deriveEncryptionKey(
  sharedSecret: ArrayBuffer
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: HKDF_SALT,
      info: new TextEncoder().encode("mobile-vault-relay-v1"),
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    key,
    encoded
  );
  return JSON.stringify({
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(ciphertext),
  });
}

export async function decrypt(
  payload: string,
  key: CryptoKey
): Promise<string> {
  const { iv, data } = JSON.parse(payload) as { iv: string; data: string };
  const ivBuf = base64ToArrayBuffer(iv);
  const dataBuf = base64ToArrayBuffer(data);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuf,
      tagLength: AES_GCM_TAG_LENGTH,
    },
    key,
    dataBuf
  );
  return new TextDecoder().decode(decrypted);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
