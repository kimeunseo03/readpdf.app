type GeocodeResult = {
  latitude: number;
  longitude: number;
};

export async function geocodeAddress(
  address?: string
): Promise<GeocodeResult | undefined> {
  try {
    if (!address) return undefined;

    const apiKey = process.env.VWORLD_API_KEY;

    if (!apiKey) {
      console.warn("VWORLD_API_KEY missing");
      return undefined;
    }

    const url = new URL("https://api.vworld.kr/req/address");

    url.searchParams.set("service", "address");
    url.searchParams.set("request", "getcoord");
    url.searchParams.set("crs", "epsg:4326");
    url.searchParams.set("address", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("type", "road");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("vworld_geocode_failed", response.status);
      return undefined;
    }

    const json = await response.json();

    const point =
      json?.response?.result?.point;

    const longitude = Number(point?.x);
    const latitude = Number(point?.y);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return undefined;
    }

    return {
      latitude,
      longitude
    };
  } catch (error) {
    console.error("geocodeAddress_error", error);
    return undefined;
  }
}
