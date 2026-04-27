declare module "canvas-confetti" {
  type Options = Record<string, unknown>;
  function confetti(options?: Options): Promise<unknown> | null;
  export default confetti;
}
