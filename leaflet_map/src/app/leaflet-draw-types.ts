import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Control {
    interface DrawConstructorOptions {
      position?: L.ControlPosition;
      draw?: DrawOptions;
      edit?: EditOptions;
    }

    interface DrawOptions {
      polyline?: L.DrawOptions.PolylineOptions | false;
      polygon?: L.DrawOptions.PolygonOptions | false;
      rectangle?: L.DrawOptions.RectangleOptions | false;
      circle?: L.DrawOptions.CircleOptions | false;
      marker?: L.DrawOptions.MarkerOptions | false;
      circlemarker?: L.DrawOptions.CircleMarkerOptions | false;
    }

    interface EditOptions {
      featureGroup: L.FeatureGroup;
      // @ts-ignore
      edit?: EditHandlerOptions;
      // @ts-ignore
      remove?: boolean;
    }

    interface EditHandlerOptions {
      selectedPathOptions?: L.PathOptions;
    }
  }
}
