const __DEBUG__ = true;
const __VERSION__ = "2.0.0";
const RADIANS = Math.PI / 180;
const PROJECTION_TYPE = "AREA";

// Color definitions
const HIGHCHARTS_BLUE = "#7CB5EC";
const HIGHCHARTS_BLACK = "#434348";
const HIGHCHARTS_GREEN = "#90ED7D";
const HIGHCHARTS_ORANGE = "#F7A35C";
const HIGHCHARTS_PURPLE = "#8085E9";
const HIGHCHARTS_CYAN = "#91E8E1";
const HIGHCHARTS_PINK = "#F15C80";
const HIGHCHARTS_YELLOW = "#E4D354";
const HIGHCHARTS_TURQUOISE = "#2B908F";
const HIGHCHARTS_RED = "#F45B5B";
const HIGHCHARTS_WHITE = "#FFFFFF";
const PLOTBAND_COLOR_BLUE = "rgba(119, 152, 191, 0.25)";
const PLOTBAND_COLOR_RED = "rgba(191, 119, 152, 0.25)";

const ENABLE_CREDITS = false;

// CSV delimiters
const ITEM_DELIMITER = ",";
const TAB_DELIMITER = "\t";
const LINE_DELIMITER = "\n";

document.title = "Paleomagnetism.org " + __VERSION__;

function getRotationMatrix(lambda, phi) {

  /*
   * Function getRotationMatrix
   * Returns the rotation matrix (parameters are poorly named)
   * but this function is re-used througouth the application. It may be azimuth, plunge
   * or co-latitude, longitude of Euler pole
   */

  return new Array(
    new Array(Math.cos(lambda) * Math.sin(phi), -Math.sin(lambda), Math.cos(phi) * Math.cos(lambda)),
    new Array(Math.sin(phi) * Math.sin(lambda), Math.cos(lambda), Math.sin(lambda) * Math.cos(phi)),
    new Array(-Math.cos(phi), 0, Math.sin(phi))
  );

}

function extractNumbers(string) {

  /*
   * Function extractNumbers
   * Extracts number from a string (e.g. 100C, 100mT will become 100)
   */

  return Number(string.replace(/[^0-9.]/g, ""));

}

function getMime(id) {

  /*
   * Function getMime
   * Returns appropriate mime type
   */

  // Get the correct type
  switch(id.split("-").pop()) {
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
  }

}

function getStatisticalParameters(components) {

  /*
   * Function getStatisticalParameters
   * Returns statistical parameters based on on a directional distirbution
   */

  // Create a fake site at 0, 0 since we only look at the distritbuion of VGPs and not the actual positions
  var site = new Site(0, 0);

  // Get the directions and pole for each vector
  var directions = components.filter(x => !x.rejected).map(x => literalToCoordinates(x.coordinates).toVector(Direction));
  var poles = directions.map(x => site.poleFrom(x));

  var directionDistribution = new DirectionDistribution(directions);
  var poleDistribution = new PoleDistribution(poles);

  // Butler parameters are a function of A95, the inclination (paleolatitude)
  var butler = getButlerParameters(poleDistribution.confidence, directionDistribution.mean.inc);

  return {
    "dir": directionDistribution,
    "pole": poleDistribution,
    "butler": butler
  }

}

function getButlerParameters(confidence, inclination) {

  /*
   * Function getButlerParameters
   * Returns butler parameters for a distribution
   */

  // Convert to radians
  var A95 = confidence * RADIANS;
  var palat = paleolatitude(inclination) * RADIANS;
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

function paleolatitude(inc) {

  /*
   * Function paleolatitude
   * Calculates the paleolatitude from an inclination
   */

  return Math.atan(Math.tan(inc * RADIANS) / 2) / RADIANS;

}

function meanDirection(vectors) {

  /*
   * Function meanDirection
   * Calculates the mean vector from a set of directions
   */

  var sumVector = new Coordinates(0, 0, 0);

  vectors.map(vector => vector.toCartesian()).forEach(function(coordinates) {
    sumVector = sumVector.add(coordinates);
  });

  return sumVector.toVector(Direction);

}

function TMatrix(data) {

  /*
   * Function TMatrix
   * Returns the orientation matrix for a set of directions
   */

  var T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

  data.forEach(function(vector) {
    for(var k = 0; k < 3; k++) {
      for(var l = 0; l < 3; l++) {
        T[k][l] += vector[k] * vector[l]
      }
    }
  });

  return T;

}

function inReferenceCoordinates(reference, specimen, coordinates) {

  /*
   * Function inReferenceCoordinates
   * Gets the coordinates in the reference coordinates
   */

  if(reference === "specimen") {
    return coordinates;
  }

  // Do the geographic correction
  coordinates = coordinates.rotateTo(specimen.coreAzimuth, specimen.coreDip);

  if(reference === "geographic") {
    return coordinates;
  }

  // Do the tectonic correction
  // See Lisa Tauxe: 9.3 Changing coordinate systems; last paragraph
  return coordinates.correctBedding(specimen.beddingStrike, specimen.beddingDip);

}

function fromReferenceCoordinates(reference, specimen, coordinates) {

  /*
   * Function fromReferenceCoordinates
   * Rotates all the way back to specimen coordinates
   */

  // We are already in specimen coordinates
  if(reference === "specimen") {
    return coordinates; 
  }

  // In geographic: rotate backwards to specimen
  if(reference === "geographic") {
    return coordinates.rotateFrom(specimen.coreAzimuth, specimen.coreDip);
  }

  // In tectonic coordinates: inverse bedding correction
  // and geographic correctiono at the end
  var dipDirection = specimen.beddingStrike + 90;
  return coordinates.rotateTo(-dipDirection, 90).rotateFrom(0, 90 - specimen.beddingDip).rotateTo(dipDirection, 90).rotateFrom(specimen.coreAzimuth, specimen.coreDip);

}

function getRotationMatrixR(lambda, phi) {

  /*
   * Function getRotationMatrixR
   * Returns the reversed rotation matrix (transpose)
   */

  return new Array(
    new Array(Math.cos(lambda) * Math.sin(phi), Math.sin(phi) * Math.sin(lambda), -Math.cos(phi)),
    new Array(-Math.sin(lambda), Math.cos(lambda), 0),
    new Array(Math.cos(phi) * Math.cos(lambda), Math.sin(lambda) * Math.cos(phi), Math.sin(phi))
  );

}

Number.prototype.clamp = function(min, max) {

  /*
   * Function Number.clamp
   * Clamps a number between a minimum and a maximum
   */

   return Math.min(Math.max(this, min), max);

}

function getConfidenceEllipse(angle) {

  /*
   * Function getConfidenceEllipse
   * Returns confidence ellipse around up North
   */

  // Define the number of discrete points on an ellipse
  const NUMBER_OF_POINTS = 101;

  var vectors = new Array();

  // Create a circle around the pole with angle confidence
  for(var i = 0; i < NUMBER_OF_POINTS; i++) {
    vectors.push(new Direction((i * 360) / (NUMBER_OF_POINTS - 1), 90 - angle));
  }

  // Handle the correct distribution type
  return vectors;

}

function getSelectedComponents() {

  /*
   * Function getSelectedComponents
   * Gets all the components from all collections as if it was a single collection
   */

  var components = new Array();

  // Get the requested polarity
  var polarity = document.getElementById("polarity-selection").value || null;

  getSelectedCollections().forEach(function(collection) {

    // Get the components in the correct coordinate system
    var comp = collection.components.map(x => x.inReferenceCoordinates());

    // Nothing to do
    if(polarity === null) {
      return components = components.concat(comp);
    }

    // Nothing to do
    var sign = Math.sign(getStatisticalParameters(comp).dir.mean.inc);
    if((sign === 1 && polarity === "NORMAL") || (sign === -1 && polarity === "REVERSED")) {
      return components = components.concat(comp);
    }

    // Reflect the coordinates
    comp.forEach(function(x) {
      components.push(new Component(x, x.coordinates.reflect()));
    });

  });

  return components;

}

function getSelectedCollections() {

  /*
   * Function getSelectedCollections
   * Returns a reference to the sites that were selected
   */

  function isSelected(option) {
    return option.selected; 
  }

  function mapIndexToSite(index) {
    collections[index].index = index;
    return collections[index];
  }

  function getIndex(option) {
    return Number(option.value);
  }

  return Array.from(document.getElementById("specimen-select").options).filter(isSelected).map(getIndex).map(mapIndexToSite);

}

function getPlaneData(direction, angle) {

  /*
   * Function getPlaneData
   * Returns plane data
   */

  function rotateEllipse(x) {

    /*
     * Function getPlaneData::rotateEllipse
     * Rotates each point on an ellipse (plane) to the correct direction
     */

    return x.toCartesian().rotateTo(direction.dec, direction.inc).toVector(Direction).highchartsData();

  }

  // No angle is passed: assume a plane (angle = 90)
  if(angle === undefined) {
    angle = 90;
  }

  return getConfidenceEllipse(angle).map(rotateEllipse);

}

var shallowingRunning, foldtestRunning;

function switchCoordinateReference() {

  /*
   * Function switchCoordinateReference
   * Cycles through the available coordinate reference frames
   */

  const AVAILABLE_COORDINATES = new Array(
    "specimen",
    "geographic",
    "tectonic"
  );

  // Block when a module is running
  if(shallowingRunning || foldtestRunning) {
    return notify("danger", "Cannot change coordinate system while a module is running.");
  }

  // Increment the counter
  COORDINATES_COUNTER++;

  COORDINATES_COUNTER = COORDINATES_COUNTER % AVAILABLE_COORDINATES.length
  COORDINATES = AVAILABLE_COORDINATES[COORDINATES_COUNTER];

  notify("info", "Coordinate system changed to <b>" + COORDINATES + "</b> coordinates.");

  // Always redraw the interpretation charts after a reference switch
  redrawCharts();

}

function notify(type, text) {

  /*
   * Function notify
   * Sends notification to the user
   */

  // Load the audio files
  const warning = new Audio("../resources/sounds/error.mp3");
  const notification = new Audio("../resources/sounds/notification.mp3");

  // Jump to the top
  if(type !== "info") {
    window.scrollTo(0, 0);
  }

  // Play sound if enabled
  if(document.getElementById("enable-sound") && document.getElementById("enable-sound").checked) {

    if(type === "warning" || type === "danger") {
      warning.play();
    } else if(type === "success") {
      notification.play();
    }

  }

  // Update the notification tooltip
  document.getElementById("notification-container").innerHTML = [
    "<div class='alert alert-" + type + "' alert-dismissible fade show' role='alert'>",
      "<button type='button' class='close' data-dismiss='alert' aria-label='Close'>",
        "<span aria-hidden='true'>&times;</span>",
      "</button>",
      text,
    "</div>"
  ].join("\n");

}


function clearLocalStorage(item) {

  /*
   * Function clearLocalStorage
   * Clears the local storage of the webpage
   */

  const COLLECTION_STORAGE_ITEM = "collections";
  const SPECIMEN_STORAGE_ITEM = "specimens";

  function clearStorage(item) {

    /*
     * Function clearStorage
     * Clears a particular item or full storage
     */

    switch(item) {
      case "interpretation":
        return localStorage.removeItem(SPECIMEN_STORAGE_ITEM);
      case "statistics":
        return localStorage.removeItem(COLLECTION_STORAGE_ITEM);
      default:
        return localStorage.clear();
    }

  }

  // Ask for user confirmation
  if(!confirm("Are you sure you want to clear the local storage?")) {
    return;
  }

  // Clear the requested item
  clearStorage(item);

  // Reload the page
  window.location.reload();

}

function fEquals(one, two) {

  /*
   * Function fEquals
   * Test the equality of two floats to a given precision
   */

  const PRECISION = 10;

  return one.toPrecision(PRECISION) === two.toPrecision(PRECISION);

}

function downloadURIComponent(name, string) {

  /*
   * Function downloadURIComponent
   * Creates a temporary link component used for downloading
   */

  var downloadAnchorNode = document.createElement("a");

  // Set some attribtues
  downloadAnchorNode.setAttribute("href", string);
  downloadAnchorNode.setAttribute("download", name);

  // Add and trigger click event
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();

  // Clean up
  document.body.removeChild(downloadAnchorNode);

}

function downloadAsJSON(filename, json) {

  /*
   * Function downloadAsJSON
   * Downloads a particular GeoJSON object  as a BLOB
   */

  const MIME_TYPE = "data:application/json;charset=utf-8";

  downloadURIComponent(filename, MIME_TYPE + "," + encodeURIComponent(JSON.stringify(json)));

}

function downloadAsCSV(filename, csv) {

  /*
   * Function downloadAsCSV
   * Downloads a particular CSV string as a BLOB
   */

  const MIME_TYPE = "data:text/csv;charset=utf-8";

  downloadURIComponent(filename, MIME_TYPE + "," + encodeURIComponent(csv));

}


function memcpy(object) {

  /*
   * Function memcpy
   * Uses a JSON (de-)serialization to create a copy of an object in memory
   */

  return JSON.parse(JSON.stringify(object));

}

function projectInclination(inc) {

  /*
   * Function projectInclination
   * Converts the inclination to a project inclination (equal area; equal angle)
   * used in the equal area projection plots
   */

  // Value can be treated as being absolute since the
  // lower & upper hemisphere are both being projected
  var inc = Math.abs(inc);

  switch(PROJECTION_TYPE) {
    case "AREA":
      return 90 - (Math.sqrt(2) * 90 * Math.sin(Math.PI * (90 - inc) / 360));
    case "ANGLE":
      return 90 - (90 * Math.tan(Math.PI * (90 - inc) / 360));
    default:
      throw(new Exception("Unknown projection type requested."));
  }

}

function HTTPRequest(url, type, callback) {

  /*
   * Function HTTPRequest
   * Makes an async XMLHTTPRequest to a remote resource
   */

  const HTTP_OK = 200;

  var xhr = new XMLHttpRequest();

  // When the resource is ready
  xhr.onload = function() {

    console.debug(type + " HTTP Request to " + url + " returned with status code " + this.status);

    // Ignore HTTP errors
    if(this.status !== HTTP_OK) {
      return callback(null);
    }

    // Check the content type
    switch(this.getResponseHeader("Content-Type")) {
      case "text/plain":
        return callback(xhr.response);
      default:
        return callback(JSON.parse(xhr.response));
    }

  }

  // Ingore HTTP errors
  xhr.onerror = function(error) {
    callback(null);
  }

  // Open and finish the request
  xhr.open(type, url);
  xhr.send();

}

function literalToCoordinates(coordinates) {

  /*
   * Function literalToCoordinates
   * Returns an object literal {x, y, z} to a Coordinate instance
   */

  return new Coordinates(coordinates.x, coordinates.y, coordinates.z);

}

function readMultipleFiles(files, callback) {

  /*
   * Function readMultipleFiles
   * Uses the HTML5 FileReader API to read mutliple fires and fire a callback with its contents
   */

  var readFile, file, reader
  var fileContents = new Array();

  // IIFE to read multiple files
  (readFile = function(file) {

    // All files were read
    if(!files.length) {
      return callback(fileContents);
    }

    // Next queued file: create a new filereader instance
    file = files.pop();
    reader = new FileReader();

    // XML should be readable as text
    reader.readAsText(file);

    // Callback when one file is read (this is async)
    reader.onload = function() {

      console.debug("FileReader read file " + file.name + " (" + file.size + " bytes)");

      // Append the result
      fileContents.push({
        "name": file.name,
        "data": reader.result,
        "size": file.size
      });

      // More files to read: continue
      readFile();

    }

  })();

}

function getSuccesfulLabel(bool) {

  /*
   * Function getSuccesfulLabel
   * Maps TRUE to success and FALSE to error label
   */

  return (bool ? "<i class='fas fa-check text-success'></i>" : "<i class='fas fa-times text-danger'></i>");

}

function getDemagnetizationTypeLabel(type) {

  /*
   * Function getDemagnetizationTypeLabel
   * Maps the demagnetization type to a neat symbol
   */

  switch(type) {
    case "thermal":
      return "<i class='fas fa-fire text-danger'></i>";
    case "alternating":
      return "<i class='fas fa-bolt text-warning'></i>";
    default:
      return "<i class='fas fa-question text-secondary'></i>";
  }

}

function numericSort(a, b) {

  /*
   * Function numericSort
   * Sort function to sort an array numerically
   */

  // No sorting if one is null
  if(a === null || b === null) {
    return 0;
  }

  return a > b ? 1 : a < b ? -1 : 0;

}

function addFooter() {

  /*
   * Function addFooter
   * Adds footer to all HTML pages
   */

  document.getElementById("footer-container").innerHTML = new Array(
    "<hr>",
    "<b>Paleomagnetism<span class='text-danger'>.org</span></b> &copy; " + new Date().getFullYear() + ". All Rights Reserved.",
    "<div style='float: right;' class='text-muted'><small>Version v" + __VERSION__ + "</small></div>",
    "&nbsp; <i class='fab fa-github'></i> <a href='https://github.com/Jollyfant/PMAG2'><b>Source Code</b></a>",
    "&nbsp; <i class='fas fa-balance-scale'></i> Licensed under <a href='https://github.com/Jollyfant'><b>MIT</b>.</a>",
    "<br>"
  ).join("\n");

}

function createLink(href, text) {

  return "<a href='" + href + "'>" + text + "</a>";

}

function addCollectionData(files, format) {

  switch(format) {
    case "DIR2":
      return files.forEach(addData);
    case "PMAG":
      return files.forEach(importPmag);
    default:
      throw(new Exception("Unknown importing format requested."));
  }

}

function addData(files) {

  /*
   * Function addData
   * Adds data from the Paleomagnetism 2.0.0 format to the application
   */

  files.forEach(function(file) {

    // Could be a string or object (when loaded from PID)
    if(file.data instanceof Object) {
      var json = file.data;
    } else {
      var json = JSON.parse(file.data);
    }

    // Collect some metadata from the file
    var siteName = file.name;
    var reference = json.pid;
    var components = new Array();

    json.specimens.forEach(function(specimen) {

       specimen.interpretations.forEach(function(interpretation) {

         // Skip components that are great circles!
         // These can be fitted in the interpretation portal
         if(interpretation.type === "TAU3") {
           return;
         }

         components.push(new Component(specimen, interpretation.specimen.coordinates));

       });

    });

    collections.push({
      "color": null,
      "name": siteName,
      "reference": reference,
      "components": components,
      "created": new Date().toISOString()
    });

  });

}

function exportPmag() {

  /*
   * Function exportPmag
   * Exports a list of collections as a .pmag database file
   */

  var payload = {
    "collections": collections,
    "version": __VERSION__,
    "created": new Date().toISOString()
  }

  // Encode the JSON and download to file
  downloadAsJSON("database.pmag", payload);

}

function importPMAG2(json) {

  /*
   * Function importPMAG2
   * Imports paleomagnetism database from the PMAG 2.0.0 format
   */

  json.collections.forEach(function(collection) {

    // Convert all literal coordinates to a class instance
    collection.components = collection.components.map(function(component) {
      return new Component(component, component.coordinates);
    });

    // Add to the application
    collections.push(collection);

  });

}

function importPmag(file) {

  /*
   * Function importPmag
   * Imports deprecated Paleomagnetism.org 1.0.0 format to the application
   */

  var json = JSON.parse(file.data);

  // Parse Paleomagnetism.org 2.0.0 files
  if(Number(json.version.split(".").shift()) === 2) {
    return importPMAG2(json);
  }

  json.data.forEach(function(site) {

    var metadata = site.metaData;
    var components = site.data.map(function(x, i) {

      var dec = x[0];
      var inc = x[1];
      var coords = new Direction(dec, inc).toCartesian().toLiteral();

      if(x.length > 2) {
        var strike = x[2];
        var dip = x[3];
      } else {
        var strike = 0;
        var dip = 0;
      }

      if(x.length > 4) {
        var name = x[4];
      } else {
        var name = metadata.name + "." + i;
      }

      return new Component({
        "name": name,
        "latitude": metadata.latitude,
        "longitude": metadata.longitude,
        "age": Number(metadata.age),
        "ageMin": Number(metadata.minAge),
        "ageMax": Number(metadata.maxAge),
        "coreAzimuth": 0,
        "coreDip": 90,
        "beddingStrike": strike,
        "beddingDip": dip,
      }, coords);

    });

    // Add the site to the collection
    collections.push({
      "color": metadata.markerColor,
      "name": metadata.name,
      "reference": "specimen",
      "components": components,
      "created": json.dateExported
    });

  });

}

(function(Highcharts) {

  /*
   * Highcharts closure
   * Modifies some Highcharts settings
   */

  // Highcharts patching
  Highcharts.seriesTypes.line.prototype.requireSorting = false;

  // SVG combined exporting
  Highcharts.exportCharts = function(charts, options) {
    options = Highcharts.merge(Highcharts.getOptions().exporting, options);
    Highcharts.getSVG(charts, options, function(svg) { 
      Highcharts.downloadSVGLocal(svg, options, function() { 
        notify("danger", "Failured to export figure.");
      });
    });
  }

  // Add CSV export button
  Highcharts.getOptions().exporting.buttons.contextButton.menuItems.push({
    "text": "Download CSV File",
    "onclick": function() {
      if(!this.userOptions.exporting.hasOwnProperty("getCSV")) { 
        return notify("danger", "CSV exporting for this graph is not implemented.");
      }
      this.userOptions.exporting.getCSV();
    }
  });
  
  // Set global default options for all charts
  Highcharts.setOptions({
    "exporting": {
      "fallbackToExportServer": false 
    }
  });

  Highcharts.getSVG = function(figure, options, callback) {
  
    function fail() {
  
      /*
       * Function Highcharts.getSVG::fail
       * Callback function fired when exporting fails
       */
  
      notify("danger", "Could not export charts.");
  
    }
  
    function getChartOffsets(id) {
  
      /*
       * Function Highcharts.getSVG::getChartOffsets
       * Returns the individual chart offsets in compilation figures
       */
  
      switch(id) {
        case "foldtest-geographic-container":
        case "direction-container":
        case "ei-bootstrap-container":
        case "ctmd-container-x":
        case "zijderveld-container":
        case "declination-container":
        case "magstrat-container-declination":
          return {"width": 0, "top": 0}
        case "foldtest-tectonic-container":
        case "pole-container":
        case "hemisphere-container":
        case "magstrat-container-inclination":
        case "pole-container":
          return {"width": 600, "top": 0}
        case "foldtest-full-container":
        case "ei-cdf-container":
        case "intensity-container":
        case "inclination-container":
          return {"width": 0, "top": 600}
        case "ctmd-container-y":
        case "magstrat-container-binary":
          return {"width": 400, "top": 0}
        case "ctmd-container-z":
          return {"width": 800, "top": 0}
        case "paleolatitude-container":
          return {"width": 0, "top": 1200}
      }
  
    }
  
    function getChartSize(id) {
  
      /*
       * Function Highcharts.getSVG::getChartSize
       * Returns the expected size for compilation figures
       */
  
      switch(id) {
        case "foldtest":
          return {"top": 1200, "width": 1200}
        case "coordinate-bootstrap":
          return {"top": 400, "width": 1200}
        case "geomagnetic-directions":
          return {"top": 600, "width": 1200}
        case "shallowing":
        case "interpretation":
          return {"top": 1200, "width": 1200}
        case "predicted":
          return {"top": 1800, "width": 1200}
        case "magstrat":
          return {"top": 800, "width": 1000}
      }
  
    }
  
    var svgArr = new Array();
  
    function addSVG(svgres, id) {
  
      // Get the offset
      var offset = getChartOffsets(id);
  
      // Offset the position of this chart in the final SVG
      var svg = svgres.replace('<svg', '<g transform="translate(' + offset.width + ',' + offset.top + ')" ').replace('</svg>', '</g>');
  
      svgArr.push(svg);
  
    }
  
    var size = getChartSize(figure.id);
    var charts = figure.charts;
    var next;
  
    // Must be handled asynchronously
    (next = function() {
  
      if(charts.length === 0) {
        return callback('<svg height="' + size.top + '" width="' + size.width + '" version="1.1" xmlns="http://www.w3.org/2000/svg">' + svgArr.join('') + '</svg>');
      }
  
      var chart = charts.pop();
  
      chart.getSVGForLocalExport(options, {}, fail, function(svg) {
        addSVG(svg, chart.renderTo.id);
        next();
      });
  
    })();
  
  }

})(Highcharts);

function exportChartsWrapper(id, charts, type) {

  /*
   * Function exportChartsWrapper
   * Wrapping function for calling Highcharts exporting
   */

  Highcharts.exportCharts({id, charts}, {"type": getMime(type)});

}

// Add the footer to every page that includes the utils
addFooter();