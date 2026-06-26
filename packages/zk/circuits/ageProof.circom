pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

/**
 * AgeProof — prove age >= minAge without revealing the actual age.
 *
 * Private input: age     (the secret; never leaves the prover)
 * Public input:  minAge  (the threshold being proven against)
 * Output:        valid   (1 when age >= minAge; the circuit is otherwise unsatisfiable)
 *
 * Build (requires `npm i circomlib`):
 *   circom ageProof.circom -l node_modules --wasm --r1cs --sym -o ../build/
 */
template AgeProof() {
    signal input age;       // private
    signal input minAge;    // public
    signal output valid;    // 1 iff age >= minAge

    // 8-bit comparison — ample for human ages (0–255).
    component ge = GreaterEqThan(8);
    ge.in[0] <== age;
    ge.in[1] <== minAge;

    valid <== ge.out;
    valid === 1;            // a valid proof can only exist when age >= minAge
}

component main { public [minAge] } = AgeProof();
