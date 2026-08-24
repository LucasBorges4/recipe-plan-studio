import { argon2id, argon2Verify } from "hash-wasm";

/**
 * Armazenamento seguro de senhas.
 *
 * Camadas aplicadas sobre a senha informada pelo usuário:
 *
 * 1. PEPPER  — segredo global de servidor (env AUTH_PEPPER ou valor gerado e
 *              persistido no banco), injetado como `secret` do próprio
 *              Argon2 (keyed hashing). Nunca é armazenado junto ao hash.
 * 2. SALT    — aleatório por usuário (16 bytes via WebCrypto), embutido na
 *              string PHC do hash; garante hashes distintos para senhas iguais.
 * 3. ARGON2ID— função de hashing resistente a GPU/ASIC (OWASP: m=19 MiB,
 *              t=2, p=1, saída de 32 bytes).
 *
 * A string PHC completa (parâmetros + salt + hash) é o que vai para a coluna
 * `password_hash`; o salt também é espelhado em coluna própria para auditoria.
 */

const ARGON_PARAMS = {
  iterations: 2,
  parallelism: 1,
  memorySize: 19_456, // KiB ≈ 19 MiB
  hashLength: 32,
} as const;

export const SALT_BYTES = 16;
export const PEPPER_BYTES = 32;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateSaltHex(): string {
  return Buffer.from(randomBytes(SALT_BYTES)).toString("hex");
}

export function generatePepperBase64(): string {
  return Buffer.from(randomBytes(PEPPER_BYTES)).toString("base64");
}

function toUint8(data: string | Uint8Array): Uint8Array {
  if (typeof data !== "string") return data;
  return new TextEncoder().encode(data);
}

/** Gera o hash PHC completo ($argon2id$...) de uma senha nova. */
export async function hashPassword(
  password: string,
  pepper: string,
  saltHex: string,
): Promise<string> {
  return argon2id({
    password: toUint8(password),
    salt: toUint8(saltHex),
    secret: toUint8(pepper),
    outputType: "encoded",
    ...ARGON_PARAMS,
  });
}

/**
 * Verifica a senha contra o hash PHC armazenado usando a mesma pepper.
 * Executa sempre a verificação completa (mesmo com usuário inexistente o
 * chamador fornece um hash dummy) para reduzir diferenças de tempo.
 */
export async function verifyPassword(
  password: string,
  pepper: string,
  phcHash: string,
): Promise<boolean> {
  try {
    return await argon2Verify({
      password: toUint8(password),
      hash: phcHash,
      secret: toUint8(pepper),
    });
  } catch {
    return false;
  }
}

/** Hash dummy válido (mesmos parâmetros) usado quando o e-mail não existe, para uniformizar o tempo de resposta do login. */
export function getDummyPasswordHash(): string {
  return "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0MTIzNDU2$6lJxwn0XWAYosKoFUJ/+/l6Rza3em6cqeygRdkcKc+g";
}
