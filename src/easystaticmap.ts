import * as util from "./util";

type Coordinate = {
  lat: number;
  lon: number;
};

type Point = {
  x: number;
  y: number;
};

type MultiPolygon = {
  coords: [number, number][][];
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
};

type StaticMapOptions = {
  width: number;
  height: number;
  tilesize?: 512 | 256;
  tileURL: string;
};

interface Tile {
  url: string;
  x: number;
  y: number;
}

const defaultOptions: { tilesize: 256 | 512 } = {
  tilesize: 256,
};

export class EasyStaticMap {
  opt: StaticMapOptions;
  center: Point = { x: 0, y: 0 };
  zoom: number = 10;
  canvas: any;
  ctx: any;
  multipolygons: MultiPolygon[] = [];

  constructor(options: StaticMapOptions) {
    this.opt = {
      ...defaultOptions,
      ...options,
    };
  }

  generateTileURL(tileX: number, tileY: number) {
    var tileURL = this.opt.tileURL;
    const subdomainPattern = tileURL.match(/{([a-z])-([a-z])}/);
    if (subdomainPattern) {
      const startChar = subdomainPattern[1];
      const endChar = subdomainPattern[2];
      const startCharCode = startChar.charCodeAt(0);
      const endCharCode = endChar.charCodeAt(0);

      if (startCharCode > endCharCode) {
        throw new Error("Invalid subdomain range.");
      }

      //Create all possible subdomains.
      const subdomains = Array.from(
        { length: endCharCode - startCharCode + 1 },
        (_, i) => String.fromCharCode(startCharCode + i)
      );

      const randomSubdomain =
        subdomains[Math.floor(Math.random() * subdomains.length)];

      tileURL = tileURL.replace(/{[a-z]-[a-z]}/, randomSubdomain);
    }

    tileURL = tileURL
      .replace("{z}", this.zoom.toString())
      .replace("{y}", tileY.toString())
      .replace("{x}", tileX.toString());

    return tileURL;
  }

  xToPos(x) {
    return (x - this.center.x) * this.opt.tilesize + this.opt.width / 2;
  }

  yToPos(y) {
    return (y - this.center.y) * this.opt.tilesize + this.opt.height / 2;
  }

  async drawBaseMap() {
    const tilePromises = this.getTileURLS().map((tile) =>
      fetch(tile.url)
        .then((response) => response.blob())
        .then((blob) => createImageBitmap(blob))
        .then((imageBitmap) => ({ imageBitmap, x: tile.x, y: tile.y }))
    );

    const tiles = await Promise.all(tilePromises);

    tiles.forEach((tile) => {
      this.ctx.drawImage(
        tile.imageBitmap,
        tile.x,
        tile.y,
        this.opt.tilesize,
        this.opt.tilesize
      );
    });
  }

  serializeSVG(svg: string, callback: (img: HTMLImageElement) => void) {
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.src = url;
    img.onload = () => {
      callback(img);
      URL.revokeObjectURL(url);
    };
  }

  addMultiPolygon(feature: MultiPolygon) {
    this.multipolygons.push(feature);
  }

  async renderMap(center: Coordinate, zoom: number, canvasID: string) {
    this.canvas = document.getElementById(canvasID) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = this.opt.width;
    this.canvas.height = this.opt.height;
    this.center = {
      x: util.lonToX(center.lon, zoom),
      y: util.latToY(center.lat, zoom),
    };
    this.zoom = zoom;

    await this.drawBaseMap();
    await this.drawMultiPolygons();
  }

  async drawMultiPolygons() {
    if (this.multipolygons.length < 1) {
      return;
    }
    let polyPaths = [];

    this.multipolygons.forEach((feature) => {
      const shapes = feature.coords.map((shape) => {
        return shape.map((coord) => {
          return [
            this.xToPos(util.lonToX(coord[1], this.zoom)),
            this.yToPos(util.latToY(coord[0], this.zoom)),
          ];
        });
      });

      const paths = shapes.map((points) => {
        const start = points.shift();
        const parts = [
          `M ${start[0]} ${start[1]}`,
          ...points.map((p) => `L ${p[0]} ${p[1]}`),
          "Z",
        ];

        return parts.join(" ");
      });

      polyPaths.push(`<path
      d="${paths.join(" ")}"
      style="fill-rule: inherit;"
      stroke="${feature.strokeColor}"
      fill="${feature.fillColor}"
      stroke-width="${feature.strokeWidth}"/>`);
    });
    let svgString = `
    <svg
      width="${this.opt.width}px"
      height="${this.opt.height}px"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg">
      ${polyPaths.join("\n")}
    </svg>`;

    this.serializeSVG(svgString, (img: HTMLImageElement) => {
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    });
  }

  getTileURLS(): Tile[] {
    let xMin = Math.floor(
      this.center.x - (0.5 * this.opt.width) / this.opt.tilesize
    );
    let yMin = Math.floor(
      this.center.y - (0.5 * this.opt.height) / this.opt.tilesize
    );
    let yMax = Math.ceil(
      this.center.y + (0.5 * this.opt.height) / this.opt.tilesize
    );
    let xMax = Math.ceil(
      this.center.x + (0.5 * this.opt.width) / this.opt.tilesize
    );

    let tiles: Tile[] = [];
    for (let x = xMin; x < xMax; x++) {
      for (let y = yMin; y < yMax; y++) {
        let maxTile = 2 ** this.zoom;
        let tileX = (x + maxTile) % maxTile;
        let tileY = (y + maxTile) % maxTile;

        let posX = (x - xMin) * this.opt.tilesize;
        let posY = (y - yMin) * this.opt.tilesize;

        tiles.push({
          url: this.generateTileURL(tileX, tileY),
          x: posX,
          y: posY,
        });
      }
    }

    //These are needed so the HTML canvas renders them properly.
    let centerXPos = (this.center.x - xMin) * this.opt.tilesize;
    let centerYPos = (this.center.y - yMin) * this.opt.tilesize;
    let offsetPosX = this.canvas.width / 2 - centerXPos;
    let offsetPosY = this.canvas.height / 2 - centerYPos;

    tiles.forEach((tile) => {
      tile.x += offsetPosX;
      tile.y += offsetPosY;
    });

    return tiles;
  }
}

export default EasyStaticMap;
