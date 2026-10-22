declare module 'javascript-lp-solver' {
  interface Model {
    optimize: string;
    opType: 'min' | 'max';
    constraints: Record<string, { equal?: number; max?: number; min?: number }>;
    variables: Record<string, Record<string, number>>;
    binaries?: Record<string, 1>;
    ints?: Record<string, 1>;
  }
  const solver: { Solve(model: Model): { feasible: boolean; result: number; bounded?: boolean; [k: string]: number | boolean | undefined } };
  export default solver;
}
