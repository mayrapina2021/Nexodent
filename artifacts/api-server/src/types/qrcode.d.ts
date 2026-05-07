declare module "qrcode" {
  function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
  function toString(text: string, options?: Record<string, unknown>): Promise<string>;
  export { toDataURL, toString };
  export default { toDataURL, toString };
}
