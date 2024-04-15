export function lonToX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom;
}

export function latToY(lat: number, zoom: number) {
  return (
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
    2 ** zoom
  );
}

export function xToLon(x: number, zoom: number) {
  return (x / 2 ** zoom) * 360 - 180;
}

export function yToLat(y: number, zoom: number) {
  return (
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** zoom))) / Math.PI) * 180
  );
}
