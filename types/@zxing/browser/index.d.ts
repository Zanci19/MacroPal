declare module "@zxing/browser" {
  export class BrowserMultiFormatReader {
    constructor(hints?: unknown, timeBetweenScansMillis?: number);
    decodeFromVideoDevice(
      deviceId: string | null,
      video: HTMLVideoElement | string,
      callback: (result: any | undefined, error?: any, controls?: any) => void
    ): Promise<any>;
    decodeOnceFromVideoDevice(
      deviceId: string | null,
      video: HTMLVideoElement | string
    ): Promise<any>;
    reset(): void;
    static listVideoInputDevices(): Promise<MediaDeviceInfo[]>;
  }
  export class NotFoundException extends Error {}
}
