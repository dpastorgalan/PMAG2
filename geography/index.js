var collections = new Array();
var mapMakers = new Array();

function addMap() {

  const MAP_CONTAINER = "map";
  const TILE_LAYER = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const VIEWPORT = new L.latLng(35, 0);

  // Reload the map when the tab is focussed on
  $("#nav-apwp-tab").on("shown.bs.tab", mapTabFocusHandler);

  // Set map options (bounds)
  var mapOptions = {
    "minZoom": 2,
    "maxBounds": new L.latLngBounds(new L.latLng(-90, -180), new L.latLng(90, 180)),
    "maxBoundsViscosity": 0.5,
    "attributionControl": true
  }

  // Create the map and tile layer
  map = L.map(MAP_CONTAINER, mapOptions).setView(VIEWPORT, 1);
  L.tileLayer(TILE_LAYER).addTo(map);

  // Add a lovely grid layer: good job guy who did this
  window.gridLayer = L.latlngGraticule({
    "opacity": 0.5,
    "color": HIGHCHARTS_WHITE,
    "fontColor": HIGHCHARTS_BLACK,
    "font": "12px Helvetica",
    "showLabel": true,
    "zoomInterval": [
        {"start": 2, "end": 3, "interval": 30},
        {"start": 4, "end": 4, "interval": 10},
        {"start": 5, "end": 7, "interval": 5},
        {"start": 8, "end": 10, "interval": 1},
        {"start": 10, "end": 12, "interval": 0.25}
    ]
  }).addTo(map);

  // Attach a click handler
  map.on("click", mapClickHandler);

}

function toggle() {

  if(!document.getElementById("defaultCheck1").checked && map.hasLayer(window.gridLayer)) {
    map.removeLayer(window.gridLayer);
  } else {
    map.addLayer(window.gridLayer);
  }

}

function mapClickHandler(event) {

  /*
   * Function mapClickHandler
   * Handles mouse click event on the map
   */
 
  const LOCATION_PRECISION = 5;
 
  // Extract the latitude, longitude
  document.getElementById("site-longitude-input").value = event.latlng.lng.toPrecision(LOCATION_PRECISION);
  document.getElementById("site-latitude-input").value = event.latlng.lat.toPrecision(LOCATION_PRECISION);
 
}

function mapTabFocusHandler() {

  map.invalidateSize();


}

addMap();

function getPublicationFromPID() {

  /*
   * Function getPublicationFromPID
   * Returns the resource that belogns to the PID
   */

  // Get the publication from the URL
  var SHA256 = location.search.substring(1);

  HTTPRequest("publications.json", "GET", function(PUBLICATIONS) {

    var pid = SHA256;
    var publication = PUBLICATIONS.filter(x => x.pid === pid);

    if(!publication.length) {
      return notify("danger", "Data from this persistent identifier could not be found.");
    }

    // Request the persistent resource from disk
    HTTPRequest("./publications/" + pid + ".pid", "GET", function(json) {
      addData([{"data": json, "name": publication[0].filename}]);
      __unlock__();
    });

  });

}

function __init__() {

  // Check local storage
  if(!window.localStorage) {
    return notify("warning", "Local storage is not supported by your browser. Save your work manually by exporting your data.");
  }

  if(location.search) {
    return getPublicationFromPID();
  }

  // Load the specimens from local storage
  var item = localStorage.getItem("collections");

  // Nothing returned from local storage
  if(item === null) {
    collections = new Array();
  } else {

    // Convert literals to components
    collections = JSON.parse(item).map(function(x) {
      x.components = x.components.map(function(y) {
        return new Component(y, y.coordinates);
      });
      return x;
    });

  }

  notify("success", "Welcome to the statistics portal. Add data below from the <b>Paleomagnetism.org 2.0.0</b> format to get started.");

  __unlock__();

}

function saveLocalStorage(force) {

  /*
   * Function saveLocalStorage
   * Saves sample object to local storage
   */

  if(!force && !document.getElementById("auto-save").checked) {
    return;
  }

  if(!force && window.location.search) {
    return;
  }

  // Attempt to set local storage
  try {
    localStorage.setItem("collections", JSON.stringify(collections));
  } catch(exception) {
    notify("danger", "Could not write to local storage. Export your data manually to save it.");
  }

}

function __unlock__() {

  if(collections.length) {
    notify("success", "Welcome back! Succesfully loaded <b>" + collections.length + "</b> collection(s).");
    enable();
  } else {
    notify("success", "Welcome to <b>Paleomagnetism.org</b>! Import data from the <b>Paleomagnetism 2.0.0</b> format below to get started.");
  }

  registerEventHandlers();

}

function enable() {

  $(".selectpicker").selectpicker("show");
  $("#nav-apwp-tab").tab("show");

  updateSpecimenSelect();
  $(".selectpicker").selectpicker("val", "0");

  redrawCharts();

}

var COORDINATES_COUNTER = 0;
var COORDINATES = "specimen";

function keyboardHandler(event) {

  /*
   * Function keyboardHandler
   * Handles keypresses on keyboard
   */

  const CODES = {
    "KEYPAD_EIGHT": 56,
    "ESCAPE_KEY": 27
  }

  if(collections.length === 0) {
    return;
  }

  // Override the default handlers
  if(!Object.values(CODES).includes(event.keyCode)) {
    return;
  }

  event.preventDefault();

  // Delegate to the appropriate handler
  switch(event.keyCode) {
    case CODES.KEYPAD_EIGHT:
      return switchCoordinateReference();
    case CODES.ESCAPE_KEY:
      return document.getElementById("notification-container").innerHTML = "";
  }

}

function registerEventHandlers() {

  /*
   * Function registerEventHandlers
   * Registers DOM event listeners and handler
   */

  // Simple listeners
  //document.getElementById("euler-upload").addEventListener("change", eulerSelectionHandler);
  document.getElementById("customFile").addEventListener("change", fileSelectionHandler);
  document.getElementById("specimen-select").addEventListener("change", siteSelectionHandler);
  document.getElementById("cutoff-selection").addEventListener("change", redrawCharts);
  document.getElementById("polarity-selection").addEventListener("change", redrawCharts);
  document.addEventListener("keydown", keyboardHandler);
  document.getElementById("defaultCheck1").addEventListener("change", toggle);

  // Always set grid to false
  document.getElementById("defaultCheck1").checked = true;

}

function getSelectedItems(id) {

  /*
   * Function getSelectedPlates
   * Returns a reference to the sites that were selected
   */

  function isSelected(option) {
    return option.selected;
  }

  function getIndex(option) {
    return option.value;
  }

  return Array.from(document.getElementById(id).options).filter(isSelected).map(getIndex);

}

document.getElementById("calculate-reference").addEventListener("click", doThing);

function doThing() {

  function mapPlateName(name) {

    switch(name) {
      case "AF":
        return "Africa";
      case "AR":
        return "Arabia";
      case "AU":
        return "Australia";
      case "CA":
        return "Caribbean";
      case "EA":
        return "East Antarctica";
      case "EU":
        return "Eurasia";
      case "GR":
        return "Greenland";
      case "IB":
        return "Iberia";
      case "IN":
        return "India";
      case "MA":
        return "Madagascar";
      case "NA":
        return "North America";
      case "PA":
        return "Pacific";
      case "SA":
        return "South America";
      default:
        return name;
    }

  }

  var site = new Site({
    "lat": Number(document.getElementById("site-latitude-input").value),
    "lng": Number(document.getElementById("site-longitude-input").value)
  });

  var dataSeriesDeclination = new Array();
  var dataSeriesInclination = new Array();
  var dataSeriesPaleolatitude = new Array();
  var dataSeriesPoles = new Array();

  var counter = 0;

  var plates = getSelectedItems("plate-select");
  var references = getSelectedItems("reference-select").map(x => APWPs[x]);

  if(plates.length === 0) {
    return notify("danger", "Select at least one plate on the right hand side.");
  }

  if(references.length === 0) {
    return notify("danger", "Select at least one reference model on the left hand side.");
  }

  plates.forEach(function(plate) {

    references.forEach(function(APWP) {

      var dataDeclination = new Array();
      var dataInclination = new Array();
      var dataPaleolatitude = new Array();

      var poleSeries = new Array();

      var dataDeclinationRange = new Array();
      var dataInclinationRange = new Array();
      var dataPaleolatitudeRange = new Array();

      var poleSeriesConfidence = new Array();

      // Go over each pole
      APWP.poles.forEach(function(pole) {

        if(!pole.euler.hasOwnProperty(plate)) {
          return;
        }

        var pPole = new Pole(pole.lng, pole.lat);
        var eulerPole = new EulerPole(pole.euler[plate].lng, pole.euler[plate].lat, pole.euler[plate].rot);

        var rPole = getRotatedPole(eulerPole, pPole);
        var directions = site.directionFrom(rPole);

        if(directions.dec > 180) {
          directions.dec -= 360;
        }

        // Use A95, palat to get confidence regions
        var A95 = pole.A95 * RADIANS;
        var palat = paleolatitude(directions.inc);

        var dIx = A95 * (2 / (1 + 3 * Math.pow(Math.cos((90 - palat) * RADIANS), 2))) / RADIANS;
        var dDx = Math.asin(Math.sin(A95) / Math.cos(palat * RADIANS)) / RADIANS;

        // Data series
        dataDeclination.push({"x": pole.age, "y": directions.dec});
        dataInclination.push({"x": pole.age, "y": directions.inc});
        dataPaleolatitude.push({"x": pole.age, "y": palat});

        // Confidence ranges
        dataDeclinationRange.push({"x": pole.age, "low": directions.dec - dDx, "high": directions.dec + dDx});
        dataInclinationRange.push({"x": pole.age, "low": directions.inc - dIx, "high": directions.inc + dIx});
        dataPaleolatitudeRange.push({"x": pole.age, "low": paleolatitude(directions.inc - dIx), "high": paleolatitude(directions.inc + dIx)});

        poleSeries.push({"x": rPole.lng, "y": projectInclination(rPole.lat), "inc": rPole.lat, "age": pole.age});
        poleSeriesConfidence = poleSeriesConfidence.concat(getPlaneData({"dec": rPole.lng, "inc": rPole.lat}, A95 / RADIANS));
        poleSeriesConfidence.push({"x": null, "y": null});

      });

      poleSeries.push({"x": null, "y": null});

      // Make sure that the area range and line share a color
      var color = Highcharts.getOptions().colors[counter++ % 8];

      dataSeriesDeclination.push({
        "name": mapPlateName(plate) + " (" + APWP.name + ")",
        "data": dataDeclination,
        "color": color
      }, {
        "data": dataDeclinationRange,
        "type": "arearange",
        "linkedTo": ":previous",
        "marker": {
          "enabled": false
        }
      });

      dataSeriesInclination.push({
        "name": mapPlateName(plate) + " (" + APWP.name + ")",
        "data": dataInclination,
        "color": color
      }, {
        "data": dataInclinationRange,
        "type": "arearange",
        "linkedTo": ":previous",
        "marker": {
          "enabled": false
        }
      });

      dataSeriesPaleolatitude.push({
        "name": mapPlateName(plate) + " (" + APWP.name + ")",
        "data": dataPaleolatitude,
        "color": color
      }, {
        "data": dataPaleolatitudeRange,
        "type": "arearange",
        "linkedTo": ":previous",
        "marker": {
          "enabled": false
        }
      });

      dataSeriesPoles.push({
        "name": mapPlateName(plate) + " (" + APWP.name + ")",
        "data": poleSeries,
        "lineWidth": 2,
        "color": color,
        "marker": {
          "symbol": "circle"
        }
      }, {
        "data": poleSeriesConfidence,
        "type": "line",
        "lineWidth": 2,
        "dashStyle": "ShortDash",
        "enableMouseTracking": false,
        "linkedTo": ":previous",
        "marker": {
          "enabled": false
        }
      });

    });

  });

  const CHART_CONTAINER_DECLINATION = "declination-container";
  const CHART_CONTAINER_INCLINATION = "inclination-container";
  const CHART_CONTAINER_PALEOLATITUDE = "paleolatitude-container";

  plotExpected(CHART_CONTAINER_DECLINATION, dataSeriesDeclination, site);
  plotExpected(CHART_CONTAINER_INCLINATION, dataSeriesInclination, site);
  plotExpected(CHART_CONTAINER_PALEOLATITUDE, dataSeriesPaleolatitude, site);

  plotPoles(dataSeriesPoles);

  window.scrollTo(0,document.body.scrollHeight);

}

function showCollectionsOnMap() {

  /*
   * Function showCollectionsOnMap
   * Shows the collection on a map
   */

  function resetMarkers() {

    /*
     * Function getSVGPath
     * Returns an SVG path (parachute) based on an angle and error
     */

    mapMakers.forEach(x => map.removeLayer(x));
    mapMakers = new Array();

  }

  function getSVGPath(angle, error) {

    /*
     * Function getSVGPath
     * Returns an SVG path (parachute) based on an angle and error
     */


    var radError = error * RADIANS;
    var radAngle = angle * RADIANS;

    return new Array( 
      "M 1 1",
      "L", 1 + Math.sin(radAngle + radError), 1 + Math.cos(radAngle + radError),
      "A 1 1 0 0 1", 1 + Math.sin(radAngle - radError), 1 + Math.cos(radAngle - radError),
      "Z"
    ).join(" ");

  }

  const MARKER_SIZE = 100;
  const MARKER_OPACITY = 0.5;

  var polarity = document.getElementById("polarity-selection").value || null;

  // Drop references to old markers
  resetMarkers();
 
  getSelectedCollections().forEach(function(collection) {

    // Cutoff and statistics
    var cutofC = doCutoff(collection.components.map(x => x.inReferenceCoordinates()));
    var statistics = getStatisticalParameters(cutofC.components);

    // Get the average site location from all markers
    var averageLocation = getAverageLocation(collection);

    if(averageLocation === null) {
      return;
    }

    if((polarity === "REVERSED" && statistics.dir.mean.inc > 0) || (polarity === "NORMAL" && statistics.dir.mean.inc < 0)) {
      statistics.dir.mean.inc = -statistics.dir.mean.inc
      statistics.dir.mean.dec = (statistics.dir.mean.dec + 180) % 360; 
    }

    var markerPath = getSVGPath((180 - statistics.dir.mean.dec), statistics.butler.dDx);
    var achenSvgString = "<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2'><path d='" + markerPath + "' fill='" + HIGHCHARTS_BLACK +"'/></svg>"

    var markerIcon = L.icon({
       "iconUrl": encodeURI("data:image/svg+xml," + achenSvgString).replace("#", "%23"),
       "opacity": MARKER_OPACITY,
       "iconSize": MARKER_SIZE
    });

    var markerPopupContent = [
      "<b>Collection " + collection.name.slice(0, 16) + "</b>",
      "<b>Longitude: </b>" + averageLocation.lng.toFixed(5),
      "<b>Latitude: </b>" + averageLocation.lat.toFixed(5),
      "<b>Average Declination: </b>" + statistics.dir.mean.dec.toFixed(2) + " (" + statistics.butler.dDx.toFixed(2) + ")",
      "<b>Average Inclination: </b>" + statistics.dir.mean.inc.toFixed(2),
      "<b>Number of Specimens: </b>" + collection.components.length
    ].join("<br>");

    mapMakers.push(L.marker([averageLocation.lat, averageLocation.lng], {"icon": markerIcon}).bindPopup(markerPopupContent).addTo(map));

  });


}

function getAverageLocation(site) {

  /*
   * Function getAverageLocation
   * Returns the average specimen location of a collection
   */

  // We can use declination instead of poles.. doens't really matter
  var locations = site.components.filter(x => x.location !== null).map(function(x) {
    return new Direction(x.location.lng, x.location.lat);
  });

  if(locations.length === 0) {
    return null;
  }

  var meanLocation = meanDirection(locations);

  // Keep longitude within [-180, 180]
  if(meanLocation.dec > 180) {
    meanLocation.dec -= 360;
  }

  return {
    "lng": meanLocation.dec,
    "lat": meanLocation.inc
  }

}

function plotPoles(dataSeries) {

  /*
   * Function plotPoles
   * Plotting function for APWPs
   */

  function tooltip() {

    /*
     * Function plotPoles::tooltip
     * Handles tooltip for the Poles chart
     */

    return [
      "<b>" + this.series.name + "</b>",
      "<b>Age: </b>" + this.point.age + "Ma",
      "<b>Longitude: </b>" + this.x.toFixed(2),
      "<b>Latitude: </b>" + this.point.inc.toFixed(2)
    ].join("<br>");

  }

  const PLOT_POLES = true;

  // Add collection data
  getSelectedCollections().forEach(function(collection) {

    // Cutoff and statistics
    var cutofC = doCutoff(collection.components.map(x => x.inReferenceCoordinates()));

    convertedComps = cutofC.components.map(function(x) {
      var s = new Site(x.location);
      return new Component(x, s.poleFrom(literalToCoordinates(x.coordinates).toVector(Direction)).toCartesian());
    });

    var statistics = getStatisticalParameters(convertedComps);

    // Plot individual specimens
    if(PLOT_POLES) {

      var data = convertedComps.map(function(x) {

        var pole = x.coordinates.toVector(Pole);

        return {
          "x": pole.lng,
          "y": projectInclination(pole.lat),
          "inc": pole.lat,
          "age": x.age.value,
          "marker": {
            "symbol": "circle"
          }
        }

      });

      dataSeries.push({
        "name": "Poles",
        "type": "scatter",
        "data": data
      });

    }

    dataSeries.push({
      "name": collection.name,
      "data": [{
        "x": statistics.dir.mean.dec,
        "y": projectInclination(statistics.dir.mean.inc),
        "inc": projectInclination(statistics.dir.mean.inc),
        "age": 0
      }],
      "lineWidth": 2,
      "color": HIGHCHARTS_ORANGE,
      "marker": {
        "symbol": "circle"
      }
    }, {
      "data": getPlaneData({"dec": statistics.dir.mean.dec, "inc": statistics.dir.mean.inc}, statistics.pole.confidence),
      "type": "line",
      "color": HIGHCHARTS_ORANGE,
      "lineWidth": 2,
      "dashStyle": "ShortDash",
      "enableMouseTracking": false,
      "linkedTo": ":previous",
      "marker": {
        "enabled": false
      }
    });

  });

  const CHART_CONTAINER = "poles-container";

  Highcharts.chart(CHART_CONTAINER, {
    "chart": {
      "polar": true,
      "animation": false,
      "height": 800,
    },
    "exporting": {
      "filename": "hemisphere-projection",
      "sourceWidth": 600,
      "sourceHeight": 600,
      "buttons": {
        "contextButton": {
          "symbolStroke": HIGHCHARTS_BLUE,
          "align": "right"
        }
      }
    },
    "title": {
      "text": "Apparant Polar Wander Paths"
    },
    "pane": {
      "startAngle": 0,
      "endAngle": 360
    },
    "yAxis": {
      "type": "linear",
      "reversed": true,
      "labels": {
        "enabled": false
      },
      "tickInterval": 90,
      "min": 0,
      "max": 90,
    },
    "credits": {
      "enabled": ENABLE_CREDITS,
      "text": "Paleomagnetism.org (Equal Area Projection)",
      "href": ""
    },
    "xAxis": {
      "minorTickPosition": "inside",
      "type": "linear",
      "min": 0,
      "max": 360,
      "minorGridLineWidth": 0,
      "tickPositions": [0, 90, 180, 270, 360],
      "minorTickInterval": 10,
      "minorTickLength": 5,
      "minorTickWidth": 1
    },
    "tooltip": {
      "formatter": tooltip
    },
    "plotOptions": {
      "series": {
        "turboThreshold": 0,
        "animation": false
      }
    },
    "series": dataSeries
  });

}

function getAverageAge(collection) {

  var age = 0;
  var min = -Number.MAX_SAFE_INTEGER;
  var max = Number.MAX_SAFE_INTEGER;

  collection.components.forEach(function(component) {
    min = Math.max(min, component.age.min);
    max = Math.min(max, component.age.max);
    age += component.age.value;
  });
  
  return {
    "value": age / collection.components.length,
    "min": min,
    "max": max
  }

}

function randomIntFromInterval(min,max) {

  return Math.floor(Math.random()*(max-min+1)+min);

}

function plotExpected(container, dataSeries, site) {

  var title;
  if(container === "declination-container") {
    title = "Predicted Declination";
  } else if(container === "inclination-container") {
    title = "Predicted Inclination";
  } else if(container === "paleolatitude-container") {
    title = "Predicted Paleolatitude";
  }

  function tooltip() {

    /*
     * Function plotPoles::tooltip
     * Handles tooltip for the Poles chart
     */

    return [
      "<b>" + this.series.name + "</b>",
      "<b>Age: </b>" + this.point.x + "Ma",
      "<b>" + title +": </b>" + this.point.y.toFixed(2)
    ].join("<br>");

  }

  const PLOT_SPECIMENS = true;
  const AGE_SCATTER = true;

  // Add collection data
  getSelectedCollections().forEach(function(collection) {

    // Cutoff and statistics
    var cutofC = doCutoff(collection.components.map(x => x.inReferenceCoordinates()));

    // Convert each direction to a pole and get the direction at the reference point
    var convertedComps = cutofC.components.map(function(x) {
      var realPole = new Site(x.location).poleFrom(literalToCoordinates(x.coordinates).toVector(Direction));
      return new Component(x, site.directionFrom(realPole).toCartesian());
    });

    // Plot individual specimens
    if(PLOT_SPECIMENS) {

      var data = convertedComps.map(function(x) {

        var direction = x.coordinates.toVector(Direction);
        if(direction.dec > 180) {
          direction.dec -= 360;
        }

        return {
          "x": AGE_SCATTER ? randomIntFromInterval(x.age.min, x.age.max) : x.age.value,
          "y": direction.dec
        }

      });

      dataSeries.push({
        "name": "Specimens",
        "type": "scatter",
        "data": data,
        "marker": {
          "symbol": "circle"
        }
      });

      return;

    }

    var statistics = getStatisticalParameters(convertedComps);
    var avAge = getAverageAge(collection);

    if(statistics.dir.mean.dec > 180) {
      statistics.dir.mean.dec -= 360;
    }
    
    if(container === "declination-container") {

      dataSeries.push({
        "name": collection.name,
        "color": HIGHCHARTS_ORANGE,
        "data": [{
          "x": avAge.value,
          "y": statistics.dir.mean.dec
        }]
      }, {
        "name": "Confidence",
        "type": "line",
        "linkedTo": ":previous",
        "enableMouseTracking": false,
        "lineWidth": 1,
        "color": HIGHCHARTS_ORANGE,
        "marker": {
          "enabled": false
        },
        "data": [{
          "x": Number(avAge.min),
          "y": statistics.dir.mean.dec
        }, {
          "x": Number(avAge.max),
          "y": statistics.dir.mean.dec
        }, {
          "x": null,
          "y": null
        }, {
          "x": Number(avAge.value),
          "y": statistics.dir.mean.dec + statistics.butler.dDx
        }, {
          "x": Number(avAge.value),
          "y": statistics.dir.mean.dec - statistics.butler.dDx
        }]
      });

    } else if(container === "inclination-container") {

      dataSeries.push({
        "name": collection.name,
        "color": HIGHCHARTS_ORANGE,
        "data": [{
          "x": avAge.value,
          "y": statistics.dir.mean.inc
        }]
      }, {
        "name": "Confidence",
        "type": "line",
        "linkedTo": ":previous",
        "enableMouseTracking": false,
        "lineWidth": 1,
        "color": HIGHCHARTS_ORANGE,
        "marker": {
          "enabled": false
        },
        "data": [{
          "x": Number(avAge.min),
          "y": statistics.dir.mean.inc
        }, {
          "x": Number(avAge.max),
          "y": statistics.dir.mean.inc
        }, {
          "x": null,
          "y": null
        }, {
          "x": Number(avAge.value),
          "y": statistics.dir.mean.inc + statistics.butler.dIx
        }, {
          "x": Number(avAge.value),
          "y": statistics.dir.mean.inc - statistics.butler.dIx
        }]
      });

    } else if(container === "paleolatitude-container") {

      dataSeries.push({
        "name": collection.name,
        "color": HIGHCHARTS_ORANGE,
        "data": [{
          "x": avAge.value,
          "y": statistics.dir.lambda
        }]
      }, {
        "name": "Confidence",
        "type": "line",
        "linkedTo": ":previous",
        "enableMouseTracking": false,
        "lineWidth": 1,
        "color": HIGHCHARTS_ORANGE,
        "marker": {
          "enabled": false
        },
        "data": [{
          "x": Number(avAge.min),
          "y": statistics.dir.lambda
        }, {
          "x": Number(avAge.max),
          "y": statistics.dir.lambda
        }, {
          "x": null,
          "y": null
        }, {
          "x": Number(avAge.value),
          "y": paleolatitude(statistics.dir.mean.inc + statistics.butler.dIx)
        }, {
          "x": Number(avAge.value),
          "y": paleolatitude(statistics.dir.mean.inc - statistics.butler.dIx)
        }]
      });

    }

  });

  new Highcharts.chart(container, {
    "chart": {
      "zoomType": "xy",
      "animation": false,
      "renderTo": container
    },
    "title": {
      "text": title
    },
    "subtitle": {
      "text": "<b> At site (latitude: </b>" + site.lat + "<b> longitude: </b>" + site.lng + ")"
    },
    "xAxis": {
      "reversed": true,
      "title": {
        "text": "Age (Ma)"
      }
    },
    "yAxis": {
      "title": {
        "text": title + " (°)"
      }
    },
    "plotOptions": {
      "series": {
        "animation": false
      },
      "arearange": {
        "enableMouseTracking": false,
        "fillOpacity": 0.3,
      },
      "line": {
        "turboThreshold": 0,
        "marker": {
          "symbol": "circle"
        }
      }
    },
    "exporting": {
      "filename": "expected-" + title,
      "sourceWidth": 1200,
      "sourceHeight": 600,
      "buttons": {
        "contextButton": {
          "symbolStroke": HIGHCHARTS_BLUE,
          "align": "right"
        }
      }
    },
    "legend": {
      "maxHeight": 60
    },
    "tooltip": {
      "formatter": tooltip
    },
    "credits": {
      "enabled": ENABLE_CREDITS,
      "text": "Paleomagnetism.org [Expected Polar wander] - <i>after van Hinsbergen et al., 2015 </i>",
      "href": ""
    },
    "series": dataSeries
  });

}

function redrawCharts() {

  /*
   * Function redrawCharts
   * Functions that handles logic of which charts to redraw
   */

  var tempScrollTop = window.pageYOffset || document.scrollingElement.scrollTop || document.documentElement.scrollTop;

  showCollectionsOnMap();
  doThing();

  window.scrollTo(0, tempScrollTop);

}

function siteSelectionHandler() {

  /*
   * Function siteSelectionHandler
   * Handler fired when the collection selector changes
   */

  redrawCharts();

}

var Component = function(specimen, coordinates) {

  this.name = specimen.name
  this.rejected = false;

  this.location = specimen.location;
  this.age = specimen.age;

  this.coreAzimuth = specimen.coreAzimuth
  this.coreDip = specimen.coreDip
  this.beddingStrike = specimen.beddingStrike
  this.beddingDip = specimen.beddingDip

  this.coordinates = literalToCoordinates(coordinates);

}

Component.prototype.inReferenceCoordinates = function(coordinates) {

  if(coordinates === undefined) {
    coordinates = COORDINATES;
  }

  // Return a itself as a new component but in reference coordinates
  return new Component(this, inReferenceCoordinates(coordinates, this, this.coordinates));

}

function addData(files) {

  files.forEach(function(file) {

    if(file.data instanceof Object) {
      var json = file.data;
    } else {
      var json = JSON.parse(file.data);
    }

    var siteName = file.name;
    var reference = json.pid;
    var components = new Array();

    json.specimens.forEach(function(specimen) {

       specimen.interpretations.forEach(function(interpretation) {

         // Skip components that are great circles
         if(interpretation.type === "TAU3") {
           return;
         }

         components.push(new Component(specimen, interpretation.specimen.coordinates));

       });

    });

    // Do the cutoff and accept/reject direction
    collections.push({
      "name": siteName,
      "reference": reference,
      "components": components,
      "created": new Date().toISOString()
    });

  });

}

function addPrototypeSelection(x, i) {

  /*
   * Function addPrototypeSelection
   * Adds a prototype to the user prototype selection box
   */

  var option = document.createElement("option");

  option.text = x.name;
  option.value = i;

  document.getElementById("specimen-select").add(option);

}

function updateSpecimenSelect() {

  /*
   * Function updateSpecimenSelect
   * Updates the specimenSelector with new samples
   */

  removeOptions(document.getElementById("specimen-select"));

  collections.forEach(addPrototypeSelection);

  $('.selectpicker').selectpicker('refresh');

}

function removeOptions(selectbox) {

  /*
   * Function removeOptions
   * Removes options from a select box
   */

  Array.from(selectbox.options).forEach(function(x) {
    selectbox.remove(x);
  });

}

function getCutoffAngle(type) {

  switch(type) {
    case "CUTOFF45":
      return 45;
    default:
      return 0;
  }

}

function getStatisticalParameters(directions) {

  var site = new Site({"lng": 0, "lat": 0});

  var poles = directions.filter(x => !x.rejected).map(x => site.poleFrom(literalToCoordinates(x.coordinates).toVector(Direction)));
  var dirs = directions.filter(x => !x.rejected).map(x => literalToCoordinates(x.coordinates).toVector(Direction));

  var p = new PoleDistribution(poles);
  var d = new DirectionDistribution(dirs);

  var butler = getButlerParameters(p.confidence, d.lambda, d.mean.inc);

  return {
    "dir": d,
    "pole": p,
    "butler": butler
  }

}

function getButlerParameters(confidence, lambda, inclination) {

  /*
   * Function getButlerParameters
   * Returns butler parameters for a distribution
   */

  // Convert to radians
  var A95 = confidence * RADIANS;
  var palat = lambda * RADIANS;
  var inc = inclination * RADIANS;

  // The errors are functions of paleolatitude
  var dDx = Math.asin(Math.sin(A95) / Math.cos(palat));
  var dIx = 2 * A95 / (1 + 3 * Math.pow(Math.sin(palat), 2));

  // Calculate the minimum and maximum Paleolatitude from the error on the inclination
  var palatMax = Math.atan(0.5 * Math.tan(inc + dIx));
  var palatMin = Math.atan(0.5 * Math.tan(inc - dIx));

  return new Object({
    "dDx": dDx / RADIANS,
    "dIx": dIx / RADIANS,
    "palatMin": palatMin / RADIANS,
    "palatMax": palatMax / RADIANS
  });

}

$('.selectpicker').selectpicker('hide');

function doCutoff(directions) {

  /*
   * Function doCutoff
   * Does the Vandamme or 45-cutoff
   */

  // Get the cutoff type from the DOM
  var cutoffType = document.getElementById("cutoff-selection").value || null;

  // Create a fake site at 0, 0
  var site = new Site({"lng": 0, "lat": 0});

  // Create a copy in memory
  var iterateDirections = memcpy(directions);

  while(true) {

    var index;
    var deltaSum = 0;
    var cutoffValue = getCutoffAngle(cutoffType);

    // Calculate the poles & mean pole from the accepted group
    var poles = iterateDirections.filter(x => !x.rejected).map(x => site.poleFrom(literalToCoordinates(x.coordinates).toVector(Direction)));
    var poleDistribution = new PoleDistribution(poles);

    // Go over all all poles
    iterateDirections.forEach(function(component, i) {

      // Do not incude directions that were already rejected
      if(component.rejected) {
        return;
      }

      var pole = site.poleFrom(literalToCoordinates(component.coordinates).toVector(Direction));

      // Find the angle between the mean VGP (mLon, mLat) and the particular VGPj.
      var angleToMean = poleDistribution.mean.toCartesian().angle(pole.toCartesian());

      // Capture the maximum angle from the mean and save its index
      if(angleToMean > cutoffValue) {
        cutoffValue = angleToMean;
        index = i;
      }

      // Add to t he sum of angles
      deltaSum += Math.pow(angleToMean, 2);

    });

    // Calculate ASD (scatter) and optimum cutoff angle (A) (Vandamme, 1994)
    var ASD = Math.sqrt(deltaSum / (poles.length - 1));
    var A = 1.8 * ASD + 5;

    if(cutoffType === null) {
      break;
    }

    // Vandamme cutoff
    if(cutoffType === "VANDAMME") {
      if(cutoffValue < A) {
        break;
      }
    }

    // 45 Cutoff
    if(cutoffType === "CUTOFF45") {
       if(cutoffValue <= getCutoffAngle("CUTOFF45")) {
        break;
      }   
    }

    iterateDirections[index].rejected = true;

  }

  return {
    "components": iterateDirections,
    "cutoff": cutoffValue,
    "scatter": ASD
  }

}

function sortSamples(type) {

  /*
   * Function sortSamples
   * Mutates the samples array in place sorted by a particular type
   */

  function getSortFunction(type) {

    /*
     * Function getSortFunction
     * Returns the sort fuction based on the requested type
     */

    function nameSorter(x, y) {
      return x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
    }

    function randomSorter(x, y) {
      return Math.random() < 0.5;
    }

    switch(type) {
      case "name":
        return nameSorter;
      case "bogo":
        return randomSorter;
    }

  }

  // Sort the samples in place
  collections.sort(getSortFunction(type));

  notify("success", "Succesfully sorted specimens by <b>" + type + "</b>.");

  updateSpecimenSelect();

}

function mapPlate(id) {

  const plateNames = {
    "101": "North America",
    "102": "Greenland",
    "103": "North Alaska",
    "104": "Mexican blocks (north Mexico)",
    "105": "Baja California",
    "113": "Northwind Ridge",
    "119": "Amerasia Basin",
    "199": "Alleghanian North America",
    "201": "South America",
    "202": "Parana Basin",
    "205": "Yucatan",
    "276": "Sandwich Plate",
    "277": "North Scotia Plate",
    "291": "Colorado-San Jorge subplate",
    "301": "Baltica",
    "304": "Iberia",
    "315": "Eurasia",
    "317": "Porcupine Plate",
    "387": "Riveria Plate",
    "401": "Siberia",
    "409": "Northeast Siberia",
    "430": "Tarim",
    "453": "Greater Amuria",
    "501": "India",
    "503": "Arabia",
    "508": "Sinai, Africa",
    "511": "Capricorn Plate",
    "514": "Elan Bank Plate",
    "601": "North China",
    "602": "South China",
    "608": "South Philippine Sea Plate",
    "610": "East Parece Vela Plate",
    "611": "West Parece Vela Plate",
    "653": "North Caroline Sea Plate",
    "688": "South Caroline Plate",
    "699": "Marianas forearc",
    "701": "South Africa",
    "702": "Madagascar",
    "704": "Seychelles",
    "709": "Somalia plate",
    "710": "Danakil plate",
    "712": "North Mozambique, Africa",
    "714": "NW Africa",
    "715": "Africa",
    "801": "Australia",
    "802": "East Antarctica",
    "804": "West Antarctica",
    "820": "South Scotia Plate",
    "833": "Lord Howe Rise",
    "901": "Pacific Plate",
    "903": "Juan de Fuca Plate",
    "904": "Phoenix Plate",
    "907": "Jan Mayen",
    "909": "Cocos Plate",
    "911": "Nazca Plate",
    "927": "North Philippine Sea Plate",
    "1001": "mobile belt (unconstrained)",
    "2007": "Caribbean plate",
    "2022": "Cuba segment",
    "2030": "Maracaibo Block",
    "2031": "Greater Panama",
    "2035": "Chortis Block",
    "2039": "Siuna terrane",
    "2047": "North Nicaraguan rise",
    "3089": "Adria",
    "3546": "Eastern Meseta south of Tell Belt",
    "3547": "Western Meseta"
  }

  if(!plateNames.hasOwnProperty(id)) {
    return {
      "name": null, "id": id
    }
  }

  return {
    "name": plateNames[id], "id": id
  }

}

function eulerSelectionHandler(event) {

  function parseLine(line) {

    var values = line.split(",");

    return {
      "id": values[0],
      "age": Number(values[1]),
      "lat": Number(values[2]),
      "lng": Number(values[3]),
      "rot": Number(values[4]),
      "rel": values[5]
    }

  }

  function byName(a, b) {

    if(a.name < b.name) return -1;
    if(a.name > b.name) return 1;
    return 0;

  }

  readMultipleFiles(Array.from(event.target.files), function(files) {

    var file = files.pop();

    var plates = new Object();
    var lines = file.data.split("\n").slice(1, -1);

    lines.forEach(function(line) {

      var entry = parseLine(line);

      // Skip anything not relative to South American Craton
      if(entry.rel !== "701") {
        return;
      }

      if(!plates.hasOwnProperty(entry.id)) {
        plates[entry.id] = new Array();
      }

      plates[entry.id].push({
        "age": entry.age,
        "lat": entry.lat,
        "lng": entry.lng,
        "rot": entry.rot
      });

      APWPs["torsvik2012"]["poles"].forEach(function(x) {
        if(x.age === entry.age) {
          x.euler[entry.id] = {"lat": entry.lat, "lng": entry.lng, "rot": entry.rot}
        }
      })

    });

    removeOptions(document.getElementById("plate-select"));

    // Add the plates
    Object.keys(plates).map(mapPlate).sort(byName).forEach(function(plate) {

      if(plate.id === "1001") {
        return;
      }

      var option = document.createElement("option");

      option.text = plate.name || plate.id;
      option.value = plate.id;

      document.getElementById("plate-select").add(option);

    });

    $(".selectpicker").selectpicker("refresh");

  });

}

function fileSelectionHandler(event) {

  /*
   * Function fileSelectionHandler
   * Callback fired when input files are selected
   */

  const cutoff = document.getElementById("cutoff-selection").value;

  readMultipleFiles(Array.from(event.target.files), function(files) {

    // Drop the samples if not appending
    if(!document.getElementById("append-input").checked) {
      collections = new Array();
    }

    var nCollections = collections.length;

    // Try adding the demagnetization data
    try {
      addData(files);
    } catch(exception) {
      return notify("danger", exception);
    }

    enable();
    saveLocalStorage();

    notify("success", "Succesfully added <b>" + (collections.length - nCollections) + "</b> specimen(s).");

  });

}


__init__();
