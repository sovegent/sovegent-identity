/**
 * Example: Notarize a document and anchor it on Liberland
 *
 * Run: npx tsx examples/notarize.ts
 */
import { SovegentIdentity } from "@sovegent/sdk";
import { LiberlandAnchorAdapter } from "@sovegent/anchors";
import { readFileSync } from "fs";

const lp = new SovegentIdentity({
  signer: {
    privateKey: process.env.PRIVATE_KEY ?? "",
    algorithm: "secp256k1",
    verificationMethod: process.env.WALLET_ADDRESS ?? "",
  },
});

const data = readFileSync("./contract.pdf");
let record = lp.notarize({ data, mimeType: "application/pdf", label: "Signed Contract" });

console.log("Notarization ID:", record.id);
console.log("Document SHA-256:", record.documentHash);
console.log("Signed at:", record.proof.created);

// Optionally anchor on Liberland
// const adapter = new LiberlandAnchorAdapter({ ... });
// record = await lp.anchor(record, adapter);
// console.log("Anchored on-chain:", record.anchor?.txHash);
