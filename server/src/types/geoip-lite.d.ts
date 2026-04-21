declare module 'geoip-lite' {
  interface Geo {
    range: [number, number];
    country: string;
    region: string;
    eu: '0' | '1';
    timezone: string;
    city: string;
    ll: [number, number];
    metro: number;
    area: number;
  }

  function lookup(ip: string): Geo | null;
}
