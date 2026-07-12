#!/usr/bin/env node
/**
 * Sovegent Identity CLI — a thin command-line wrapper over the @sovegent/* packages.
 *
 * It does NOT reimplement any crypto: keygen uses @noble/curves (the same curve
 * the core signer uses), and all attest/notarize/verify/anchor/zk operations are
 * delegated to @sovegent/sdk, @sovegent/anchors and @sovegent/zk.
 *
 * Design notes:
 *  - Hand-rolled arg parser (no arg-parsing dependency) to stay dependency-light.
 *  - Every command prints a short human status line to stderr and the JSON result
 *    to stdout, so output stays pipeable. `--out <file>` also writes the JSON.
 *  - Verification commands exit non-zero when the result is invalid/false.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";

import { SovegentIdentity } from "@sovegent/sdk";
import { CardanoAnchorAdapter } from "@sovegent/anchors";
import { generateProof, verifyProof } from "@sovegent/zk";
import type {
  SignerConfig,
  Attestation,
  NotarizationRecord,
} from "@sovegent/core";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo-root-relative default ZK artifact dir: apps/cli/src -> packages/zk/artifacts */
const ZK_ARTIFACTS = resolve(HERE, "../../../packages/zk/artifacts");

/** Print a short status line to stderr (keeps stdout clean for JSON piping). */
function status(msg: string): void {
  process.stderr.write(msg + "\n");
}

/** Print a JSON result to stdout and, if requested, to a file. */
function emit(obj: unknown, outFile?: string): void {
  const json = JSON.stringify(obj, null, 2);
  process.stdout.write(json + "\n");
  if (outFile) {
    writeFileSync(outFile, json + "\n");
    status(`wrote ${outFile}`);
  }
}

function fail(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (e) {
    fail(`could not read JSON from ${path}: ${(e as Error).message}`);
  }
}

/** base58btc encode (Bitcoin alphabet) — used to build did:key. No external dep. */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58btc(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "1".repeat(zeros);
  for (let k = digits.length - 1; k >= 0; k--) out += B58[digits[k]!];
  return out;
}

/**
 * did:key for a secp256k1 public key.
 * Multicodec prefix for secp256k1-pub is 0xe7, varint-encoded as [0xe7, 0x01],
 * prepended to the 33-byte compressed key, then multibase base58btc ("z").
 */
function didKeyFromSecp256k1(compressedPub: Uint8Array): string {
  const prefixed = new Uint8Array(2 + compressedPub.length);
  prefixed[0] = 0xe7;
  prefixed[1] = 0x01;
  prefixed.set(compressedPub, 2);
  return `did:key:z${base58btc(prefixed)}`;
}

// ---------------------------------------------------------------------------
// minimal arg parser
// ---------------------------------------------------------------------------

interface Args {
  _: string[]; // positionals
  flags: Record<string, string | boolean>;
}

/** Parse `--flag value`, `--flag=value`, `--bool`, and positionals. */
function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out.flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          out.flags[key] = next;
          i++;
        } else {
          out.flags[key] = true;
        }
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function getStr(args: Args, name: string, required = true): string | undefined {
  const v = args.flags[name];
  if (typeof v === "string") return v;
  if (required) fail(`missing required --${name}`);
  return undefined;
}

/** Load a signer config from a keygen JSON file and sanity-check its shape. */
function loadSigner(path: string): SignerConfig {
  const j = readJson<Partial<SignerConfig> & { publicKey?: string }>(path);
  if (!j.privateKey || !j.algorithm || !j.verificationMethod) {
    fail(`${path} is not a valid signer file (need privateKey, algorithm, verificationMethod)`);
  }
  return {
    privateKey: j.privateKey,
    algorithm: j.algorithm,
    verificationMethod: j.verificationMethod,
  };
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function cmdKeygen(args: Args): void {
  const priv = secp256k1.utils.randomPrivateKey();
  const pub = secp256k1.getPublicKey(priv, true); // 33-byte compressed
  const privateKey = bytesToHex(priv);
  const publicKey = bytesToHex(pub);
  const did = didKeyFromSecp256k1(pub);
  const signer: SignerConfig & { publicKey: string } = {
    privateKey,
    algorithm: "secp256k1",
    verificationMethod: did,
    publicKey,
  };
  status(`generated secp256k1 signer ${did}`);
  emit(signer, getStr(args, "out", false));
}

function cmdAttest(args: Args): void {
  const claimRaw = getStr(args, "claim")!;
  let claim: Record<string, unknown>;
  try {
    claim = JSON.parse(claimRaw);
  } catch (e) {
    return fail(`--claim is not valid JSON: ${(e as Error).message}`);
  }
  const subject = getStr(args, "subject", false) ?? "did:example:subject";
  const signer = loadSigner(getStr(args, "key")!);
  const lp = new SovegentIdentity({ signer });
  const attestation = lp.attest({ subject, claim });
  status(`signed attestation ${attestation.id}`);
  emit(attestation, getStr(args, "out", false));
}

function cmdVerifyAttestation(args: Args): void {
  const file = args._[0];
  if (!file) fail("usage: verify-attestation <file> --pubkey <pk>");
  const pubkey = getStr(args, "pubkey")!;
  const attestation = readJson<Attestation>(file);
  const lp = new SovegentIdentity({
    signer: { privateKey: "00", algorithm: "secp256k1", verificationMethod: "" },
  });
  const result = lp.verify(attestation, pubkey);
  status(result.valid ? "attestation VALID" : `attestation INVALID: ${result.reason}`);
  emit(result, getStr(args, "out", false));
  if (!result.valid) process.exit(2);
}

function cmdNotarize(args: Args): void {
  const file = args._[0];
  if (!file) fail("usage: notarize <file> --key <signerfile>");
  const signer = loadSigner(getStr(args, "key")!);
  const data = readFileSync(file);
  const mimeType = getStr(args, "mime", false) ?? "application/octet-stream";
  const label = getStr(args, "label", false);
  const lp = new SovegentIdentity({ signer });
  const record = lp.notarize({
    data: new Uint8Array(data),
    mimeType,
    ...(label !== undefined ? { label } : {}),
  });
  status(`notarized ${file} (sha256 ${record.documentHash})`);
  emit(record, getStr(args, "out", false));
}

function cmdVerifyNotarization(args: Args): void {
  const file = args._[0];
  if (!file) fail("usage: verify-notarization <recordfile> --pubkey <pk> [--file <orig>]");
  const pubkey = getStr(args, "pubkey")!;
  const record = readJson<NotarizationRecord>(file);
  const orig = getStr(args, "file", false);
  const lp = new SovegentIdentity({
    signer: { privateKey: "00", algorithm: "secp256k1", verificationMethod: "" },
  });
  const originalData = orig ? new Uint8Array(readFileSync(orig)) : undefined;
  const result = lp.verifyNotarization(record, pubkey, originalData);
  status(result.valid ? "notarization VALID" : `notarization INVALID: ${result.reason}`);
  emit(result, getStr(args, "out", false));
  if (!result.valid) process.exit(2);
}

function buildCardanoAdapter(args: Args): CardanoAnchorAdapter {
  const chain = getStr(args, "chain", false) ?? "cardano";
  if (chain !== "cardano") fail(`unsupported --chain ${chain} (only 'cardano' is wired in the CLI)`);
  const network = getStr(args, "network", false) ?? "preprod";
  if (network !== "preprod" && network !== "mainnet") {
    fail(`--network must be 'preprod' or 'mainnet'`);
  }
  const networkId: 0 | 1 = network === "mainnet" ? 1 : 0;
  return new CardanoAnchorAdapter({ networkId });
}

async function cmdAnchor(args: Args): Promise<void> {
  const file = args._[0];
  if (!file) fail("usage: anchor <recordfile> --chain cardano --address <addr> (--xprv-file <f> | --xprv <hex>)");
  const network = getStr(args, "network", false) ?? "preprod";
  if (network !== "preprod" && network !== "mainnet") fail(`--network must be 'preprod' or 'mainnet'`);
  const networkId: 0 | 1 = network === "mainnet" ? 1 : 0;
  const address = getStr(args, "address")!;
  const xprvFile = getStr(args, "xprv-file", false);
  const xprvInline = getStr(args, "xprv", false);
  if (!xprvFile && !xprvInline) fail("provide --xprv-file <f> (preferred) or --xprv <hex>");
  const paymentXprvHex = (xprvFile ? readFileSync(xprvFile, "utf8") : xprvInline!).trim();

  const record = readJson<Attestation | NotarizationRecord>(file);
  const adapter = new CardanoAnchorAdapter({ networkId, address, paymentXprvHex });
  const lp = new SovegentIdentity({
    signer: { privateKey: "00", algorithm: "secp256k1", verificationMethod: "" },
  });
  status(`anchoring proofHash ${record.proof.payloadHash} on cardano ${network} ...`);
  const anchored = await lp.anchor(record, adapter);
  status(`anchored — txid ${anchored.anchor!.txHash}`);
  emit(anchored, getStr(args, "out", false));
}

async function cmdVerifyAnchor(args: Args): Promise<void> {
  const file = args._[0];
  if (!file) fail("usage: verify-anchor <recordfile> --chain cardano [--network preprod|mainnet]");
  const adapter = buildCardanoAdapter(args);
  const record = readJson<Attestation | NotarizationRecord>(file);
  if (!record.anchor) fail("record has no .anchor to verify");
  const ok = await adapter.verify(record.proof.payloadHash, record.anchor);
  status(ok ? "anchor VERIFIED on-chain" : "anchor NOT found on-chain");
  emit({ verified: ok, chain: record.anchor.chain, txHash: record.anchor.txHash });
  if (!ok) process.exit(2);
}

async function cmdProve(args: Args): Promise<void> {
  const ageStr = getStr(args, "age")!;
  const minStr = getStr(args, "min")!;
  const age = Number(ageStr);
  const minAge = Number(minStr);
  if (!Number.isFinite(age) || !Number.isFinite(minAge)) fail("--age and --min must be numbers");
  const wasmPath = getStr(args, "wasm", false) ?? resolve(ZK_ARTIFACTS, "ageProof.wasm");
  const zkeyPath = getStr(args, "zkey", false) ?? resolve(ZK_ARTIFACTS, "ageProof.zkey");
  const outFile = getStr(args, "out")!;
  status(`generating groth16 proof (age>=${minAge}) ...`);
  let proof;
  try {
    proof = await generateProof({ witness: { age, minAge }, wasmPath, zkeyPath });
  } catch (e) {
    // A false statement (age < minAge) makes the circuit unsatisfiable -> throws.
    return fail(`proof generation failed (statement may be false): ${(e as Error).message}`);
  }
  status(`proof generated — publicSignals [valid,minAge]=${JSON.stringify(proof.publicSignals)}`);
  emit(proof, outFile);
}

async function cmdZkVerify(args: Args): Promise<void> {
  const file = args._[0];
  if (!file) fail("usage: zk-verify <prooffile> [--vkey <p>]");
  const vkeyPath = getStr(args, "vkey", false) ?? resolve(ZK_ARTIFACTS, "ageProof.vkey.json");
  const proof = readJson<Parameters<typeof verifyProof>[0]>(file);
  const ok = await verifyProof(proof, vkeyPath);
  status(ok ? "ZK proof VALID" : "ZK proof INVALID");
  emit({ valid: ok });
  if (!ok) process.exit(2);
}

// ---------------------------------------------------------------------------
// help + dispatch
// ---------------------------------------------------------------------------

const HELP = `sovegent-identity — verifiable proofs CLI

Usage: sovegent-identity <command> [options]

Commands:
  keygen                         Generate a secp256k1 signer (+ did:key). --out <file>
  attest --claim <json> [--subject <s>] --key <signerfile> [--out <f>]
                                 Create a signed attestation.
  verify-attestation <file> --pubkey <pk>
                                 Verify an attestation (exit !=0 if invalid).
  notarize <file> --key <signerfile> [--mime <t>] [--label <l>] [--out <f>]
                                 Notarize file bytes.
  verify-notarization <recordfile> --pubkey <pk> [--file <orig>]
                                 Verify a notarization record.
  anchor <recordfile> --chain cardano [--network preprod|mainnet]
         --address <addr> (--xprv-file <f> | --xprv <hex>) [--out <f>]
                                 Anchor proof hash in a Cardano tx (prints txid).
  verify-anchor <recordfile> --chain cardano [--network preprod|mainnet]
                                 Confirm the proof hash is anchored on-chain.
  prove --age <n> --min <n> [--wasm <p>] [--zkey <p>] --out <f>
                                 Generate a ZK age proof (age >= min) without revealing age.
  zk-verify <prooffile> [--vkey <p>]
                                 Verify a ZK proof.

Global:
  -h, --help                     Show this help.
`;

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(HELP);
    return;
  }
  const args = parseArgs(rest);
  if (args.flags.help || args.flags.h) {
    process.stdout.write(HELP);
    return;
  }

  switch (cmd) {
    case "keygen":
      return cmdKeygen(args);
    case "attest":
      return cmdAttest(args);
    case "verify-attestation":
      return cmdVerifyAttestation(args);
    case "notarize":
      return cmdNotarize(args);
    case "verify-notarization":
      return cmdVerifyNotarization(args);
    case "anchor":
      return cmdAnchor(args);
    case "verify-anchor":
      return cmdVerifyAnchor(args);
    case "prove":
      return cmdProve(args);
    case "zk-verify":
      return cmdZkVerify(args);
    default:
      process.stderr.write(`unknown command: ${cmd}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((e) => {
  process.stderr.write(`error: ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});
