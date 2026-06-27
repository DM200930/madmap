declare module 'leaflet.heat' {
  const _default: unknown
  export default _default
}

import 'leaflet'
declare module 'leaflet' {
  interface HeatLayerOptions {
    minOpacity?: number
    maxZoom?: number
    max?: number
    radius?: number
    blur?: number
    gradient?: Record<number, string>
  }
  type HeatLatLngTuple = [number, number, number]
  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions): Layer
}
