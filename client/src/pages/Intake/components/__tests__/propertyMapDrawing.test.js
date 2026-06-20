import { describe, expect, it } from 'vitest';
import {
  getClickPixelDistanceToFirstVertex,
  isCompactPolygon,
  rectangleToPolygon,
  shouldClosePolygonOnClick,
} from '../propertyMapDrawing.js';

function mockMap({ zoom = 19, bounds, projection, rect = { left: 0, top: 0 } }) {
  const div = {
    getBoundingClientRect: () => ({ left: rect.left, top: rect.top, width: 800, height: 600 }),
  };

  return {
    getZoom: () => zoom,
    getBounds: () => bounds,
    getProjection: () => projection,
    getDiv: () => div,
  };
}

function mockMaps() {
  function LatLng(lat, lng) {
    this.lat = () => lat;
    this.lng = () => lng;
  }
  return { LatLng };
}

describe('propertyMapDrawing', () => {
  it('builds a rectangle polygon from two corners', () => {
    const path = rectangleToPolygon(
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5002, lng: -70.3998 },
    );
    expect(path).toHaveLength(4);
    expect(path[0]).toEqual({ lat: 43.5002, lng: -70.4 });
  });

  it('detects compact polygons', () => {
    const compact = rectangleToPolygon(
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5005, lng: -70.3995 },
    );
    expect(isCompactPolygon(compact)).toBe(true);
  });

  it('rejects neighborhood-sized polygons', () => {
    const large = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.52, lng: -70.4 },
      { lat: 43.52, lng: -70.38 },
      { lat: 43.5, lng: -70.38 },
    ];
    expect(isCompactPolygon(large)).toBe(false);
  });

  it('does not close before three vertices exist', () => {
    const verts = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5001, lng: -70.4 },
    ];
    const click = { lat: 43.5, lng: -70.4 };
    expect(shouldClosePolygonOnClick(click, verts, mockMaps(), mockMap({}), null)).toBe(false);
  });

  it('does not close fourth corner of a small rectangle when far in screen space', () => {
    const maps = mockMaps();
    const projection = {
      fromLatLngToPoint(latLng) {
        return { x: latLng.lng(), y: latLng.lat() };
      },
    };
    const bounds = {
      getNorthEast: () => ({ lat: () => 43.651, lng: () => -70.258 }),
      getSouthWest: () => ({ lat: () => 43.649, lng: () => -70.261 }),
    };
    const map = mockMap({ bounds, projection });

    const verts = [
      { lat: 43.65000, lng: -70.26000 },
      { lat: 43.65000, lng: -70.25995 },
      { lat: 43.64997, lng: -70.25995 },
    ];
    const fourthCorner = { lat: 43.64997, lng: -70.26000 };

    const pixelDistance = getClickPixelDistanceToFirstVertex(
      fourthCorner,
      verts[0],
      map,
      maps,
      { domEvent: { clientX: 500, clientY: 420 } },
    );

    expect(pixelDistance).not.toBeNull();
    expect(pixelDistance).toBeGreaterThan(24);
    expect(shouldClosePolygonOnClick(fourthCorner, verts, maps, map, {
      domEvent: { clientX: 500, clientY: 420 },
    })).toBe(false);
  });

  it('closes when click is within snap pixels of the first vertex', () => {
    const maps = mockMaps();
    const projection = {
      fromLatLngToPoint(latLng) {
        return { x: latLng.lng(), y: latLng.lat() };
      },
    };
    const bounds = {
      getNorthEast: () => ({ lat: () => 43.651, lng: () => -70.258 }),
      getSouthWest: () => ({ lat: () => 43.649, lng: () => -70.261 }),
    };
    const map = mockMap({ bounds, projection, rect: { left: 100, top: 50 } });

    const first = { lat: 43.65000, lng: -70.26000 };
    const verts = [
      first,
      { lat: 43.65000, lng: -70.25990 },
      { lat: 43.64995, lng: -70.25990 },
      { lat: 43.64995, lng: -70.25980 },
    ];

    const nwWorld = projection.fromLatLngToPoint(new maps.LatLng(43.651, -70.261));
    const firstWorld = projection.fromLatLngToPoint(new maps.LatLng(first.lat, first.lng));
    const scale = 2 ** 19;
    const firstX = (firstWorld.x - nwWorld.x) * scale + 100;
    const firstY = (firstWorld.y - nwWorld.y) * scale + 50;

    expect(shouldClosePolygonOnClick(first, verts, maps, map, {
      domEvent: { clientX: firstX + 8, clientY: firstY + 8 },
    })).toBe(true);

    expect(shouldClosePolygonOnClick(first, verts, maps, map, {
      domEvent: { clientX: firstX + 80, clientY: firstY + 80 },
    })).toBe(false);
  });

  it('does not close when map cannot measure pixel distance', () => {
    const verts = [
      { lat: 43.5, lng: -70.4 },
      { lat: 43.5002, lng: -70.4 },
      { lat: 43.5002, lng: -70.3998 },
    ];
    const click = { lat: 43.5, lng: -70.4 };
    expect(shouldClosePolygonOnClick(click, verts, null, null, null)).toBe(false);
  });

  it('uses container projection when available (fullscreen-safe)', () => {
    const maps = mockMaps();
    const first = { lat: 43.65, lng: -70.26 };
    const verts = [first, { lat: 43.6501, lng: -70.26 }, { lat: 43.6501, lng: -70.2599 }];
    const containerProjection = {
      fromLatLngToContainerPixel(latLng) {
        if (latLng.lat() === first.lat && latLng.lng() === first.lng) {
          return { x: 100, y: 200 };
        }
        if (latLng.lat() === 43.66) {
          return { x: 200, y: 300 };
        }
        return { x: 108, y: 208 };
      },
    };
    const clickLatLng = { lat: () => first.lat, lng: () => first.lng };

    expect(shouldClosePolygonOnClick(first, verts, maps, mockMap({}), {
      latLng: clickLatLng,
    }, { containerProjection })).toBe(true);

    expect(shouldClosePolygonOnClick(first, verts, maps, mockMap({}), {
      latLng: { lat: () => 43.66, lng: () => -70.25 },
    }, { containerProjection })).toBe(false);
  });
});
