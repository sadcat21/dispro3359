/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal type stubs for packages that don't ship their own types
// and don't have @types/* available in the project.

declare module 'open-location-code' {
  export function encode(lat: number, lng: number, codeLength?: number): string;
  export function decode(code: string): { latitudeCenter: number; longitudeCenter: number };
  export function isFull(code: string): boolean;
  export function isShort(code: string): boolean;
}
