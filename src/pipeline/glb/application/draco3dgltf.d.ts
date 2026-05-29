declare module 'draco3dgltf' {
  export type DracoDecoderModule = {
    destroy(target: unknown): void;
  };

  const draco3d: {
    createDecoderModule(): Promise<DracoDecoderModule>;
  };

  export default draco3d;
}
