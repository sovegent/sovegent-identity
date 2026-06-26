pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";

/**
 * RangeProof — prove min <= value <= max without revealing the actual value.
 *
 * Private input: value      (the secret; never leaves the prover)
 * Public inputs: min, max   (the inclusive bounds being proven against)
 * Output:        valid      (1 when min <= value <= max; circuit is otherwise unsatisfiable)
 *
 * Build (requires `npm i circomlib`):
 *   circom rangeProof.circom -l node_modules --wasm --r1cs --sym -o ../build/
 */
template RangeProof(n) {
    signal input value;     // private
    signal input min;       // public
    signal input max;       // public
    signal output valid;    // 1 iff min <= value <= max

    // n-bit comparisons — 32 bits is ample for incomes/scores/etc. (0–4.29e9).
    component ge = GreaterEqThan(n);
    ge.in[0] <== value;
    ge.in[1] <== min;

    component le = LessEqThan(n);
    le.in[0] <== value;
    le.in[1] <== max;

    valid <== ge.out * le.out;
    valid === 1;            // a valid proof can only exist when min <= value <= max
}

component main { public [min, max] } = RangeProof(32);
