import { argon2id } from "@noble/hashes/argon2.js";

/**
 * Armazenamento seguro de senhas.
 *
 * Camadas aplicadas sobre a senha informada pelo usuário:
 *
 * 1. PEPPER  — segredo global de servidor (env AUTH_PEPPER ou valor gerado e
 *              persistido no banco), injetado como `key` do próprio
 *              Argon2 (keyed hashing). Nunca é armazenado junto ao hash.
 * 2. SALT    — aleatório por usuário (16 bytes via WebCrypto), embutido na
 *              string PHC do hash; garante hashes distintos para senhas iguais.
 * 3. ARGON2ID— função de hashing resistente a GPU/ASIC (OWASP: m=19 MiB,
 *              t=2, p=1, saída de 32 bytes).
 *
 * A string PHC completa (parâmetros + salt + hash) é o que vai para a coluna
 * `password_hash`; o salt também é espelhado em coluna própria para auditoria.
 *
 * Implementação: usa `@noble/hashes` (Argon2 puro em JavaScript), compatível
 * com o RFC 9106. Diferente de `hash-wasm` (que compilava WebAssembly em
 * runtime), não depende de `WebAssembly.compile` — necessário porque o
 * Cloudflare Workers bloqueia a compilação dinâmica de wasm por padrão.
 */

const ARGON_PARAMS = {
  iterations: 2, // t
  memorySize: 19_456, // m (KiB ≈ 19 MiB)
  parallelism: 1, // p
  hashLength: 32, // dkLen (bytes)
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

/** Base64 padrão sem padding, compatível com o formato PHC (RFC 9106). */
function b64Encode(data: Uint8Array): string {
  return Buffer.from(data).toString("base64").replace(/=+$/, "");
}

function b64Decode(data: string): Uint8Array {
  const raw = data.replace(/=+$/, "");
  return new Uint8Array(Buffer.from(raw, "base64"));
}

/** Comparação em tempo constante para evitar timing attacks no login. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function computeDerivedKey(
  password: Uint8Array,
  salt: Uint8Array,
  pepper: Uint8Array,
  params: { m: number; t: number; p: number },
): Uint8Array {
  return argon2id(password, salt, {
    t: params.t,
    m: params.m,
    p: params.p,
    dkLen: ARGON_PARAMS.hashLength,
    version: 0x13, // v=19
    key: pepper,
  });
}

/** Gera o hash PHC completo ($argon2id$...) de uma senha nova. */
export function hashPassword(
  password: string | Uint8Array,
  pepper: string,
  saltHex: string,
): string {
  const derived = computeDerivedKey(toUint8(password), toUint8(saltHex), toUint8(pepper), {
    m: ARGON_PARAMS.memorySize,
    t: ARGON_PARAMS.iterations,
    p: ARGON_PARAMS.parallelism,
  });
  const params = [
    `m=${ARGON_PARAMS.memorySize}`,
    `t=${ARGON_PARAMS.iterations}`,
    `p=${ARGON_PARAMS.parallelism}`,
  ].join(",");
  return `$argon2id$v=19$${params}$${b64Encode(toUint8(saltHex))}$${b64Encode(derived)}`;
}

/** Regex do formato PHC padrão (RFC 9106). */
const PHC_RE =
  /^\$argon2(id|i|d)\$v=([0-9]+)\$((?:[mtp]=[0-9]+,){2}[mtp]=[0-9]+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

/**
 * Verifica a senha contra o hash PHC armazenado usando a mesma pepper.
 * Executa sempre a verificação completa (mesmo com usuário inexistente o
 * chamador fornece um hash dummy) para reduzir diferenças de tempo.
 */
export function verifyPassword(
  password: string | Uint8Array,
  pepper: string,
  phcHash: string,
): boolean {
  const match = phcHash.match(PHC_RE);
  if (!match) return false;
  if (match[1] !== "id" || match[2] !== "19") return false;
  const paramsStr = match[3]!;
  const saltB64 = match[4]!;
  const expectedB64 = match[5]!;

  const params: { m: number; t: number; p: number } = { m: 0, t: 0, p: 0 };
  for (const part of paramsStr.split(",")) {
    const [k, v] = part.split("=");
    if (k === "m") params.m = Number(v);
    else if (k === "t") params.t = Number(v);
    else if (k === "p") params.p = Number(v);
  }
  if (!params.m || !params.t || !params.p) return false;

  const salt = b64Decode(saltB64);
  const expected = b64Decode(expectedB64);

  try {
    const derived = computeDerivedKey(toUint8(password), salt, toUint8(pepper), params);
    return constantTimeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Hash dummy válido (mesmos parâmetros) usado quando o e-mail não existe, para uniformizar o tempo de resposta do login. */
export function getDummyPasswordHash(): string {
  return "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlzYWx0MTIzNDU2$6lJxwn0XWAYosKoFUJ/+/l6Rza3em6cqeygRdkcKc+g";
}
