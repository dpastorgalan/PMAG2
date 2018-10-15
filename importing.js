const APPEND_IMPORT = false;
const __DEBUG__ = true;
const __VERSION__ = "2.0.0";
const RADIANS = Math.PI / 180;
const PROJECTION_TYPE = "AREA";
const MARKER_RADIUS = 4;
const MARKER_RADIUS_SELECTED = 6;

var GROUP = "DEFAULT";
var UPWEST = true;

document.getElementById("footer-container").innerHTML = [
  "<b>Paleomagnetism<span class='text-danger'>.org</span></b> &copy; " + new Date().getFullYear() + " <a href='https://paleomagnetism.org'>Mathijs Koymans</a>. All Rights Reserved.",
  "<div style='float: right;' class='text-muted'><small>Version v" + __VERSION__ + "</small></div>",
  "&nbsp; <i class='fab fa-github'></i> <a href='https://github.com/Jollyfant'><b>Source Code</b></a>",
  "&nbsp; <i class='fas fa-balance-scale'></i> Licensed under <a href='https://github.com/Jollyfant'><b>MIT</b>.</a>",
].join("\n");

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

var samples = new Array();

var Measurement = function(step, coordinates, error) {

  /*
   * Class Measurement
   * Container for a single demagnetization step
   */

  this.step = step;

  this.x = Number(coordinates.x);
  this.y = Number(coordinates.y);
  this.z = Number(coordinates.z);

  this.error = Number(error);

  this.visible = true;
  this.selected = false;

}

function importPaleoMac(file) {

  /*
   * Function importPaleoMac
   * Import parser for the PaleoMac format
   */

  // Get lines in the file
  var lines = file.data.split(/\r?\n/).slice(1).filter(Boolean);

  // The line container all the header information
  var header = lines[0].split(/[,\s\t]+/);
  var sampleName = header[0];
	
  // Get header values
  // values will be [a, b, s, d, [v]]
  var parameters = lines[0].split("=");
  var values = new Array();
  for(var i = 1; i < parameters.length; i++) {
    var value = parameters[i].match(/[+-]?\d+(\.\d+)?/g);
    values.push(value);
  }

  // Get the sample volume from file or default to 10cc
  var sampleVolume = Math.abs(Number(values[4][0]) * Math.pow(10, Number(values[4][1]))) || 10e-6;

  // core hade is measured, we use the plunge (90 - hade)
  var coreAzimuth = Number(values[0]);	
  var coreDip = 90 - Number(values[1]);
  var beddingStrike = Number(values[2]);
  var beddingDip = Number(values[3]);

  // Skip first two and last line
  var steps = lines.slice(2, -1).map(function(line) {

    // Empty parameters as 0
    var parameters = line.split(/[,\s\t]+/);

    // Get the measurement parameters
    var step = parameters[0];
    var x = 1E6 * Number(parameters[1]) / sampleVolume;
    var y = 1E6 * Number(parameters[2]) / sampleVolume;
    var z = 1E6 * Number(parameters[3]) / sampleVolume;
    var a95 = Number(parameters[9]);

    var coordinates = new Coordinates(x, y, z);

    // Skip these (intensity = 0)
    if(Number(parameters[4]) === 0) {
      return null;
    }

    return new Measurement(step, coordinates, a95);

  });

  // Add the data to the application
  samples.push({
    "demagnetizationType": null,
    "coordinates": "specimen",
    "format": "PALEOMAC",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": steps,
    "name": sampleName,
    "volume": Number(sampleVolume),
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });

}


function importOxford(file) {
	
  var lines = file.data.split(/\r?\n/).filter(Boolean);
  var parsedData = new Array();
 
  // Get specimen metadata from the first second line
  var parameters = lines[2].split(/[\t]+/);

  var coreAzimuth = Number(parameters[13]);
  var coreDip = Number(parameters[14]);
  
  var beddingStrike = (Number(parameters[15]) + 270) % 360;
  var beddingDip = Number(parameters[16]);
  
  var sampleName = parameters[0];
  var sampleVolume = Math.abs(Number(parameters[18]));

  // Determine what column to use
  // Assume anything with 'Thermal' is TH, and 'Degauss' is AF.
  if(/Thermal/.test(parameters[2])) {
    var stepIndex = 4;
    var demagnetizationType = "TH";
  } else if(/Degauss/.test(parameters[2])) {
    var stepIndex = 3;
    var demagnetizationType = "AF";
  } else {
    throw(new Exception("Could not determine type of demagnetization."));
  }
  
  var steps = lines.slice(1).map(function(line) {
	
    // Oxford is delimted by tabs
    var parameters = line.split(/[\t]+/);
    
    var intensity = 1E6 * Number(parameters[6]) / sampleVolume;
    var dec = Number(parameters[11]);
    var inc = Number(parameters[12]);

    var coordinates = new Direction(dec, inc, intensity).toCartesian();

    return new Measurement(parameters[stepIndex], coordinates, null);

  });
 
  // Add the data to the application
  samples.push({
    "demagnetizationType": demagnetizationType,
    "coordinates": "specimen",
    "format": "OXFORD",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": steps,
    "name": sampleName,
    "volume": Number(sampleVolume),
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });
    
}


function importNGU(file) {

  /*
   * Function importNGU
   * Parser for the NGU format
   */

  var lines = file.data.split(/\r?\n/).filter(Boolean);
  var parsedData = new Array();

  for(var i = 0; i < lines.length; i++) {

    // Reduce empty lines
    var parameters = lines[i].split(/[,\s\t]+/);
    parameters = parameters.filter(function(x) {
      return x !== "";
    });

    // Get the header
    if(i === 0) {

      var sampleName = parameters[0];

      // Different convention for core orientation than Utrecht
      // Munich measures the hade angle
      var coreAzimuth = Number(parameters[1]);
      var coreDip = 90 - Number(parameters[2]);

      // Bedding strike needs to be decreased by 90 for input convention
      var beddingStrike = (Number(parameters[3]) + 270) % 360;
      var beddingDip = Number(parameters[4]);
      var info = parameters[5];

    } else {

      // Get Cartesian coordinates for specimen coordinates (intensities in mA -> bring to μA)
      var intensity = 1E3 * Number(parameters[1]);
      var dec = Number(parameters[2]);
      var inc = Number(parameters[3]);

      var coordinates = new Direction(dec, inc, intensity).toCartesian();

      parsedData.push(new Measurement(parameters[0], coordinates, Number(parameters[4])));

    }
  }

  samples.push({
    "demagnetizationType": null,
    "coordinates": "specimen",
    "format": "NGU",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": parsedData,
    "name": sampleName,
    "volume": null,
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });

}

function importMunich(file) {

  /*
   * Function importMunich
   * Imports file to the Munich format
   */

  var lines = file.data.split(/\r?\n/).filter(Boolean);
  var parsedData = new Array();

  for(var i = 0; i < lines.length; i++) {
			
    // Reduce empty lines
    var parameters = lines[i].split(/[,\s\t]+/);
    parameters = parameters.filter(function(x) {
      return x !== "";
    });
			
    // Get the header
    if(i === 0) {
		
      var sampleName = parameters[0];
				
      // Different convention for core orientation than Utrecht
      // Munich measures the hade angle
      var coreAzimuth = Number(parameters[1]);
      var coreDip = 90 - Number(parameters[2]);
				
      // Bedding strike needs to be decreased by 90 for input convention
      var beddingStrike = (Number(parameters[3]) + 270) % 360;

      var beddingDip = Number(parameters[4]);
      var info = parameters[5];

    } else {

      // Get Cartesian coordinates for specimen coordinates (intensities in mA -> bring to μA)
      var dec = Number(parameters[3]);
      var inc = Number(parameters[4]);
      var intensity = Number(parameters[1]) * 1E3;
      
      var coordinates = new Direction(dec, inc, intensity).toCartesian();

      parsedData.push(new Measurement(parameters[0], coordinates, Number(parameters[2])));

    }
  }
	
  samples.push({
    "demagnetizationType": null,
    "coordinates": "specimen",
    "format": "MUNICH",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": parsedData,
    "name": sampleName,
    "volume": null,
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });

}

function importBCN2G(file) {

  /*
   * Function importBCN2G
   * Imports binary University of Barcelona 2G format
   */

  //TODO: handle declination correction

  // Split by characters
  var text = file.data.split(/[\u0002\u0003]/).slice(1);

  // Read at byte positions
  var sampleName = text[2].slice(5, 12);
  var sampleVolume = Number(text[2].slice(14, 16));

  // Core and bedding parameters
  var coreAzimuth = Number(text[2].slice(101, 104).replace(/\0/g, ""));
  var coreDip = Number(text[2].slice(106,108).replace(/\0/g, ""));
  var beddingStrike = (Number(text[2].slice(110, 113).replace(/\0/g, "")) + 270) % 360;
  var beddingDip = Number(text[2].slice(115, 117).replace(/\0/g, ""));

  // This value indicates the declination correction that needs to be applied
  var declinationCorrection = Number(text[2].slice(132, 136).replace(/\0/, ""))

  // Overturned bit flag is set: subtract 180 from the dip
  if(text[2].charCodeAt(119) === 1) {
    beddingDip = beddingDip - 180;
  }

  // For each demagnetization step
  var steps = text.slice(3).map(function(line) {

    // Each parameter is delimited by at least one NULL byte
    var parameters = line.split(/\u0000+/);

    // Intensity is in emu/cm^3 (0.001 A/m)
    var step = parameters[3];
    var dec = Number(parameters[4]);
    var inc = Number(parameters[5]);
    var intensity = 1E9 * Number(parameters[11]);

    var coordinates = new Direction(dec, inc, intensity).toCartesian();

    return new Measurement(step, coordinates, null);

  });

  samples.push({
    "demagnetizationType": null,
    "coordinates": "specimen",
    "format": "BCN2G",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": steps,
    "name": sampleName,
    "declinationCorrection": declinationCorrection,
    "volume": Number(sampleVolume),
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });

}

function importCaltech(file) {

  /*
   * Function importCaltech
   * Parses for Caltech Institute of Technology format
   */

  var lines = file.data.split(/\r?\n/).filter(Boolean);

  // Sample name is specified at the top
  var sampleName = lines[0].trim();

  // First line has the core & bedding parameters
  var coreParameters = lines[1].split(/\s+/).filter(Boolean);

  // Correct core strike to azimuth and hade to plunge
  var coreAzimuth = (Number(coreParameters[0].trim()) + 270) % 360;
  var coreDip = 90 - Number(coreParameters[1].trim());
  var beddingStrike = Number(coreParameters[2].trim());
  var beddingDip = Number(coreParameters[3].trim());
  var sampleVolume = Number(coreParameters[4].trim());
 
  var line;
  var steps = new Array();

  for(var i = 2; i < lines.length; i++) {

    line = lines[i];

    var stepType = line.slice(0, 2);
    var step = line.slice(2, 6).trim() || "0";
    var dec = Number(line.slice(46, 51));
    var inc = Number(line.slice(52, 57));

    // Intensity in emu/cm3 -> convert to micro A/m (1E9)
    var intensity = 1E9 * Number(line.slice(31, 39));
    var a95 = Number(line.slice(40, 45));
    var info = line.slice(85, 113).trim();

    var coordinates = new Direction(dec, inc, intensity).toCartesian();

    steps.push(new Measurement(step, coordinates, a95));

  }

  samples.push({
    "demagnetizationType": null,
    "coordinates": "specimen",
    "format": "CALTECH",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": steps,
    "name": sampleName,
    "volume": Number(sampleVolume),
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });


}

function importApplicationSave(file) {

  /*
   * Function importApplicationSave
   * Imports a save from the application
   */

  JSON.parse(file.data).forEach(function(specimen) {
    samples.push(specimen);
  });

}

function importUtrecht(file) {

  /*
   * Function importUtrecht
   * Treats buffer as being Utrecht Format
   */

  // Split by 9999 (Utecht specimen delimiter)
  var blocks = file.data.split(/9999\r?\n/);

  if(blocks.length === 1 || blocks[blocks.length - 1] !== "END") {
    throw(new Exception("Invalid Utrecht format."));
  }

  // We can skip the latest block
  blocks.slice(0, -1).forEach(function(specimen, i) {

    // Slice the file header information
    if(i === 0) { 
      var blockLines = specimen.split(/\r?\n/).slice(1);
    } else {
      var blockLines = specimen.split(/\r?\n/).slice(0);
    }

    var header = blockLines.shift();

    // Extract the header parameters
    var [sampleName, _, coreAzimuth, coreDip, sampleVolume, beddingStrike, beddingDip] = header.split(/,[\s]*/);

    var steps = new Array();

    // Get the actual demagnetization data
    blockLines.slice(0, -1).forEach(function(measurement) {

      var [step, a, b, c, error, _, _] = measurement.split(/,[\s]*/);

      var coordinates = new Coordinates(-b, c, -a);

      steps.push(new Measurement(step, coordinates, error));

    });

    samples.push({
      "demagnetizationType": null,
      "coordinates": "specimen",
      "format": "UTRECHT",
      "version": __VERSION__,
      "created": new Date().toISOString(),
      "steps": steps,
      "name": sampleName,
      "volume": Number(sampleVolume),
      "beddingStrike": Number(beddingStrike),
      "beddingDip": Number(beddingDip),
      "coreAzimuth": Number(coreAzimuth),
      "coreDip": Number(coreDip),
      "interpretations": new Array()
    });

  });


}

function importHelsinki(file) {

  /*
   * Function importHelsinki
   * Imports demagnetization data in the Helsinki format (plain-text csv)
   */

  var lines = file.data.split(/\r?\n/).filter(Boolean);

  // Get some header metadata
  var sampleName = lines[5].split(";")[1]
  var coreAzimuth = Number(lines[5].split(";")[7])
  var coreDip = Number(lines[6].split(";")[7])
  var sampleVolume = Number(lines[7].split(";")[2]);
  var demagnetizationType = lines[7].split(";")[7];

  // Bedding is not included: always set to 0, 0
  var beddingStrike = 0;
  var beddingDip = 0;

  var steps = new Array();

  // Skip the header (12 lines)
  lines.slice(12).forEach(function(line) {

    var parameters = line.split(";");
    var step = parameters[1];

    // Take mA/m and set to microamps (multiply by 1E3)
    var x = Number(parameters[13]) * 1E3;
    var y = Number(parameters[14]) * 1E3;
    var z = Number(parameters[15]) * 1E3;

    var coordinates = new Coordinates(x, y, z);
    steps.push(new Measurement(step, coordinates, 0));

  });

  samples.push({
    "demagnetizationType": demagnetizationType,
    "coordinates": "specimen",
    "format": "HELSINKI",
    "version": __VERSION__,
    "created": new Date().toISOString(),
    "steps": steps,
    "name": sampleName,
    "volume": Number(sampleVolume),
    "beddingStrike": Number(beddingStrike),
    "beddingDip": Number(beddingDip),
    "coreAzimuth": Number(coreAzimuth),
    "coreDip": Number(coreDip),
    "interpretations": new Array()
  });

}

function notify(type, text) {

  const ENABLE_SOUND = true;

  window.scrollTo(0, 0);

  if(ENABLE_SOUND) {
    if(type === "warning" || type === "danger") {
      warning.play();
    } else {
      notification.play();
    }
  }

  document.getElementById("notification-container").innerHTML = [
    "<div class='alert alert-" + type + "' alert-dismissible fade show' role='alert'>",
      "<button type='button' class='close' data-dismiss='alert' aria-label='Close'>",
        "<span aria-hidden='true'>&times;</span>",
      "</button>",
      text,
    "</div>"
  ].join("\n");

}

var warning = new Audio("./sounds/error.mp3");
var notification = new Audio("./sounds/notification.mp3");

function addFiles(format, files) {

  switch(format) {
    case "UTRECHT":
      return files.forEach(importUtrecht);
    case "MUNICH":
      return files.forEach(importMunich);
    case "PMAGORG":
      return files.forEach(importApplicationSave);
    case "HELSINKI":
      return files.forEach(importHelsinki);
    case "CALTECH":
      return files.forEach(importCaltech);
    case "BCN2G":
      return files.forEach(importBCN2G);
    case "NGU":
      return files.forEach(importNGU);
    case "PALEOMAC":
      return files.forEach(importPaleoMac);
    case "OXFORD":
      return files.forEach(importOxford);
    default:
      throw(new Exception("Unknown importing format requested."));
  }

}

function fileSelection(event) {

  const format = document.getElementById("format-selection").value;

  readMultipleFiles(Array.from(event.target.files), function(files) {

    // Drop the samples if not appending
    if(!APPEND_IMPORT) {
      samples = new Array();
    }

    var nSamples = samples.length;

    try {
      addFiles(format, files);
    } catch(exception) {
      return notify("danger", exception);
    }

    updateSelect();

    notify("success", "Succesfully added <b>" + (samples.length - nSamples) + "</b> specimen(s) (" + format + "). Proceed to the interpretation tab to find your data.");

  });

}

document.getElementById("customFile").addEventListener("change", fileSelection);

function updateSelect() {

  removeOptions(document.getElementById("specimen-select"));

  samples.forEach(addPrototypeSelection);
  stepSelector.reset();
  saveLocalStorage();

}

function removeOptions(selectbox) {

  Array.from(selectbox.options).forEach(function(x) {
    selectbox.remove(x);
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

function handleSpecimenScroll(direction) {

  /*
   * Function handleSpecimenScroll
   * Handles scrolling of the specimen selection box in both directions
   */

  const specimenSelectElement = document.getElementById("specimen-select");
  const options = specimenSelectElement.getElementsByTagName("option");

  if(options.length < 2) {
    return;
  }

  // Get the currently selected index
  var selectedIndex = specimenSelectElement.selectedIndex;

  // Scrolling logic
  var newIndex = selectedIndex + direction;

  if(newIndex === -1) {
    newIndex = options.length - 1;
  }

  // Select the new index
  options[newIndex % options.length].selected = "selected";

  // Manually dispatch a change event
  specimenSelectElement.dispatchEvent(new Event("change"));

}

function getSelectedSpecimen() {

  /*
   * Function getSelectedSpecimen
   * Returns the currently selected specimen object
   */

  const specimenSelectElement = document.getElementById("specimen-select");

  var selectedIndex = specimenSelectElement.selectedIndex;

  if(selectedIndex === -1) {
    return null;
  }

  return samples[selectedIndex];

}

var StepSelector = function() {

  /*
   * Class StepSelector
   * Manages the navigation, visibility, and selection of steps
   */

  // Initialize
  this.reset();

  this._container.addEventListener("click", function(event) {
    this.setActiveStep(Number(event.target.value));
  }.bind(this));

}

StepSelector.prototype.setActiveStep = function(index) {

  this._selectedStep = index;
  this.render();

}

StepSelector.prototype._container = document.getElementById("step-container");

StepSelector.prototype.reset = function() {

  /*
   * Function StepSelector.reset
   * Resets the step selector for a new specimen
   */

  this._selectedStep = 0;
  this.render();

}

StepSelector.prototype.clear = function() {

  /*
   * Function StepSelector.clear
   * Clears the HTML of the container
   */

  this._container.innerHTML = "";

}

StepSelector.prototype.render = function() {

  /*
   * Function StepSelector.render
   * Renders the stepSelector component with the current steps and properties
   */

  const HIDDEN_STEP_SYMBOL = "…";

  this.clear();

  var specimen = getSelectedSpecimen();

  if(specimen === null) {
    return;
  }

  var listSteps = document.createElement("tbody");

  // Add each steps
  specimen.steps.forEach(function(step, i) {

      var listStep = document.createElement("tr");
      listStep.value = i;

      // Attach some extra classes
      if(step.selected) {
        listStep.className = "selected";
      }

      // Highlight the current step
      if(this._selectedStep === i) {
        listStep.className += " current";
      }

      // Steps may be hidden
      if(step.visible) {
        listStep.appendChild(document.createTextNode(step.step));
      } else {
        listStep.appendChild(document.createTextNode(HIDDEN_STEP_SYMBOL));
        listStep.className += " text-muted";
      }

      listSteps.appendChild(listStep);

  }, this);

  this._container.appendChild(listSteps);

  redrawCharts();
  
}

StepSelector.prototype.formatStepTable = function() {

  /*
   * Function StepSelector.formatStepTable
   * Formats parameter table at the top of the page
   */

  var step = this.getCurrentStep();
  var specimen = getSelectedSpecimen();

  var direction = inReferenceCoordinates(COORDINATES, specimen, new Coordinates(step.x, step.y, step.z)).toVector(Direction);

  return [
    "  <caption>Specimen and Demagnetization Details</caption>",
    "  <thead>",
    "    <tr>",
    "      <td>Step</td>",
    "      <td>Coordinates</td>",
    "      <td>Declination</td>",
    "      <td>Inclination</td>",
    "      <td>Intensity (μA/m)</td>",
    "      <td>Uncertainty</td>",
    "      <td>Core Azimuth</td>",
    "      <td>Core Dip</td>",
    "      <td>Bedding Strike</td>",
    "      <td>Bedding Dip</td>",
    "      <td>Format</td>",
    "    </tr>",
    "  </thead>",
    "  <tbody>",
    "    <tr>",
    "      <td>" + step.step + "</td>",
    "      <td>" + COORDINATES + "</td>",
    "      <td>" + direction.dec.toFixed(2) + "</td>",
    "      <td>" + direction.inc.toFixed(2) + "</td>",
    "      <td>" + direction.length.toFixed(2) + "</td>",
    "      <td>" + step.error.toFixed(2) + "</td>",
    "      <td style='cursor: pointer;'>" + specimen.coreAzimuth + "</td>",
    "      <td style='cursor: pointer;'>" + specimen.coreDip + "</td>",
    "      <td style='cursor: pointer;'>" + specimen.beddingStrike + "</td>",
    "      <td style='cursor: pointer;'>" + specimen.beddingDip + "</td>",
    "      <td>" + specimen.format + "</td>",
    "    </tr>",
    "  </tbody>"
  ].join("\n");

}

document.getElementById("table-container").addEventListener("click", function(event) {

  var specimen = getSelectedSpecimen();

  switch(event.target.cellIndex) {

    case 6:
      var response = prompt("Enter a value for the core azimuth.");
      if(response === null) {
        return;
      }
      specimen.coreAzimuth = Number(response);
      break;

    case 7:
      var response = prompt("Enter a value for the core dip.");
      if(response === null) {
        return;
      }
      specimen.coreDip = Number(response);
      break;

    case 8:
      var response = prompt("Enter a value for the bedding strike.");
      if(response === null) {
        return;
      }
      specimen.beddingStrike = Number(response);
      break;

    case 9:
      var response = prompt("Enter a value for the bedding dip.");
      if(response === null) {
        return;
      }
      specimen.beddingDip = Number(response);
      break;

    default:
      return;
  }

  specimen.interpretations = new Array();

  notify("success", "The specimen has been updated. All interpretations have been reset.");

  saveLocalStorage();
  redrawCharts();

});

StepSelector.prototype.hideStep = function() {

  /*
   * Function StepSelector.hideStep
   * Hides the currently active step if not selected
   */

  var step = this.getCurrentStep();

  // Must not be selected
  if(!step.selected) {
    step.visible = !step.visible;
  }

  // Practical to move to the next step
  this.handleStepScroll(1);

  saveLocalStorage();

}

StepSelector.prototype.getCurrentStep = function() {

  return getSelectedSpecimen().steps[this._selectedStep];

}


StepSelector.prototype.selectStep = function() {

  /*
   * Function StepSelector.selectStep
   * Selects the currently active step if not hidden
   */

  var step = this.getCurrentStep();

  // Toggle select if the step is visible
  if(step.visible) {
    step.selected = !step.selected;
  }

  // Practical to move to the next step
  this.handleStepScroll(1);

  saveLocalStorage();

}

StepSelector.prototype.handleStepScroll = function(direction) {

  /*
   * Function StepSelector.handleStepScroll
   * Handles increment/decrement of the selected step
   */

  var steps = this._container.getElementsByTagName("tr");

  // There are no steps
  if(steps.length === 0) {
    return;
  }

  // Handle the scrolling logic
  this._selectedStep = this._selectedStep + direction;

  // Negative roll-over
  if(this._selectedStep === -1) {
    this._selectedStep = steps.length - 1;
  }

  // Positive roll-over
  this._selectedStep = this._selectedStep % steps.length;

  this.render();

  if(this._selectedStep > 15) {
    this._container.parentElement.scrollTop = (this._selectedStep - 15) * 24;
  } else {
    this._container.parentElement.scrollTop = 0;
  }

}

function clearLocalStorage() {

  if(!confirm("Are you sure you want to clear the local storage?")) {
    return;
  }

  localStorage.clear();
  window.location.reload();

}

function saveLocalStorage() {

  if(!document.getElementById("auto-save").checked) {
    return;
  }

  // Set local storage
  localStorage.setItem("specimens", JSON.stringify(samples));

}

function redrawCharts() {

  /*
   * Function redrawCharts
   * Redraws all the charts for the active specimen
   */

  // Save the current scroll position for later, otherwise the scroll position will
  // jump to the top when a Highcharts chart is drawn
  var tempScrollTop = window.pageYOffset || document.documentElement.scrollTop;

  var specimen = getSelectedSpecimen();

  plotZijderveldDiagram(specimen);
  plotIntensityDiagram(specimen);
  eqAreaProjection(specimen);

  updateInterpretationTable(specimen);

  document.getElementById("table-container").innerHTML = stepSelector.formatStepTable();

  // Reset the scroll position
  window.scrollTo(0, tempScrollTop);

}

document.getElementById("interpretation-table-container").addEventListener("click", function(event) {

  var specimen = getSelectedSpecimen();

  var columnIndex = event.target.cellIndex;
  var rowIndex = event.target.parentElement.rowIndex;

  if(columnIndex === 7) {
    var comment = prompt("Enter a comment for this interpretation");
    specimen.interpretations[rowIndex - 1].comment = comment;
  } else if(columnIndex === 9) {
    specimen.interpretations.splice(rowIndex - 1, 1);
  }

  redrawCharts();
  saveLocalStorage();

});

function updateInterpretationTable(specimen) {

  if(specimen.interpretations.length === 0) {
    return document.getElementById("interpretation-table-container").innerHTML = "";
  }

  var tableHeader = new Array(
    "<table class='table table-sm table-striped'>",
    "  <caption>Interpreted Components</caption>",
    "  <tr>",
    "    <td>Declination</td>",
    "    <td>Inclination</td>",
    "    <td>MAD</td>",
    "    <td>Type</td>",
    "    <td>Anchored</td>",
    "    <td>Steps</td>",
    "    <td>Group</td>",
    "    <td>Comment</td>",
    "    <td>Created</td>",
    "    <td></td>",
    "  </tr>"
  ).join("\n");

  const COMMENT_LENGTH = 15;

  var rows = specimen.interpretations.map(function(interpretation) {

    // Get the interpretation in the right reference frame
    var coodinates = interpretation[COORDINATES];

    var direction = new Coordinates(coodinates.x, coodinates.y, coodinates.z).toVector(Direction);

    // Handle comments on interpretations
    if(interpretation.comment === null) {
      comment = "Click to add";
    } else {
      comment = interpretation.comment;
    }

    return [
      "  </tr>",
      "    <td>" + direction.dec.toFixed(2) + "</td>",
      "    <td>" + direction.inc.toFixed(2) + "</td>",
      "    <td>" + coodinates.MAD.toFixed(2) + "</td>",
      "    <td>" + interpretation.type + "</td>",
      "    <td>" + interpretation.anchored + "</td>",
      "    <td>" + interpretation.steps.length + "</td>",
      "    <td>" + interpretation.group + "</td>",
      "    <td title='" + comment + "'>" + ((comment.length < COMMENT_LENGTH) ? comment : comment.slice(0, COMMENT_LENGTH) + "…") + "</td>",
      "    <td>" + interpretation.created + "</td>",
      "    <td class='text-center text-danger' style='text-align: center; cursor: pointer;'><i style='pointer-events: none;' class='fas fa-times'></i></td>",
      "  </tr>"
    ].join("\n");

  });

  var tableFooter = "</table>";

  document.getElementById("interpretation-table-container").innerHTML = tableHeader + rows.join("\n") + tableFooter;

}

document.getElementById("specimen-select").addEventListener("change", function(event) {

  var specimen = getSelectedSpecimen();

  if(specimen === null) {
    return;
  }

  // Create a new step selector
  stepSelector.reset();

});

document.addEventListener("keydown", keyboardHandler);

function interpretationTabOpen() {

  return Array.from($("#nav-tab a.active")).pop().id === "interpretation-container";

}

function keyboardHandler(event) {

  /*
   * Function keyboardHandler
   * Handles keypresses on keyboard
   */

  // Block all key commands if the interpretation tab is not open
  if(!interpretationTabOpen()) {
    return;
  }

  const CODES = {
    "ARROW_RIGHT": 39,
    "ARROW_LEFT": 37,
    "ARROW_UP": 38,
    "ARROW_DOWN": 40,
    "W_KEY": 87,
    "D_KEY": 68,
    "S_KEY": 83,
    "A_KEY": 65,
    "Z_KEY": 90,
    "X_KEY": 88,
    "G_KEY": 71,
    "MINUS_KEY": 173,
    "MINUS_KEY_NUM": 109,
    "PLUS_KEY": 61,
    "PLUS_KEY_NUM": 107,
    "KEYPAD_ONE": 49,
    "KEYPAD_TWO": 50,
    "KEYPAD_THREE": 51,
    "KEYPAD_EIGHT": 56,
    "ESCAPE_KEY": 27
  }

  if(samples.length === 0) {
    return;
  }

  // Override the default handlers
  if(!Object.values(CODES).includes(event.keyCode)) {
    return;
  }
  
  event.preventDefault();

  // Delegate to the appropriate handler
  switch(event.keyCode) {
    case CODES.ARROW_RIGHT:
    case CODES.D_KEY:
      return handleSpecimenScroll(1);
    case CODES.ARROW_LEFT:
    case CODES.A_KEY:
      return handleSpecimenScroll(-1);
    case CODES.ARROW_DOWN:
    case CODES.S_KEY:
      return stepSelector.handleStepScroll(1);
    case CODES.ARROW_UP:
    case CODES.W_KEY:
      return stepSelector.handleStepScroll(-1);
    case CODES.MINUS_KEY:
    case CODES.MINUS_KEY_NUM:
    case CODES.Z_KEY:
      return stepSelector.hideStep();
    case CODES.PLUS_KEY:
    case CODES.PLUS_KEY_NUM:
    case CODES.X_KEY:
      return stepSelector.selectStep();
    case CODES.G_KEY:
        return setGroup();
    case CODES.KEYPAD_ONE:
      if(event.ctrlKey) {
        return makeInterpretation({"type": "TAU1", "anchored": true});
      } else {
        return makeInterpretation({"type": "TAU1", "anchored": false});
      }
    case CODES.KEYPAD_TWO:
      if(event.ctrlKey) {
        return makeInterpretation({"type": "TAU3", "anchored": true});
      } else {
        return makeInterpretation({"type": "TAU3", "anchored": false});
      }
    case CODES.KEYPAD_THREE:
      return switchProjection();
    case CODES.KEYPAD_EIGHT:
      return switchCoordinates();
    case CODES.ESCAPE_KEY:
      return document.getElementById("notification-container").innerHTML = "";
  }

}

var COORDINATES_COUNTER = 0;
var COORDINATES = "specimen";

function setGroup() {

  /*
   * Function setGroup
   * Sets an active group
   */

  var group = prompt("Set new group! Leave empty for default.");

  if(group === null) {
    return;
  }

  if(group === "") {
    GROUP = "DEFAULT";
  } else {
    GROUP = group;
  }

  notify("success", "Succesfully changed group to <b>" + GROUP + "</b>.");

}

function sortSamples(type) {

  switch(type) {

    case "name":
      samples.sort(function(x, y) {
        return x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
      });
      break;
    case "bogo":
      samples.sort(function(x, y) {
        return Math.random() < 0.5;
      });
      break;
  }

  updateSelect();

}

function switchCoordinates() {

  var AVAILABLE_COORDINATES = [
    "specimen",
    "geographic",
    "tectonic"
  ];

  COORDINATES_COUNTER++;
  COORDINATES_COUNTER = COORDINATES_COUNTER % AVAILABLE_COORDINATES.length
  COORDINATES = AVAILABLE_COORDINATES[COORDINATES_COUNTER];

  redrawCharts();

}

function switchProjection() {

  UPWEST = !UPWEST;
  redrawCharts();

}

function makeInterpretation(options) {

  var specimen = getSelectedSpecimen();

  // Get the selected steps
  var selectedSteps = specimen.steps.filter(function(step) {
    return step.selected;
  });

  if(selectedSteps.length < 2) {
    return notify("danger", "A minimum of two selected steps is required.");
  }

  var stepValues = selectedSteps.map(x => x.step);

  // Check if the interpretation already exists
  var exists = Boolean(specimen.interpretations.filter(function(interpretation) {
    return interpretation.steps.join() === stepValues.join() && interpretation.type === options.type && interpretation.anchored === options.anchored;
  }).length);

  if(exists) {
    return notify("warning", "This component already exists.");
  }

  // Attach the interpretation to the specimen
  specimen.interpretations.push({
    "steps": stepValues,
    "anchored": options.anchored,
    "type": options.type,
    "anchored": options.anchored,
    "created": new Date().toISOString(),
    "group": GROUP,
    "comment": null,
    "version": __VERSION__,
    "specimen": makeInterpretations(options, selectedSteps, "specimen"),
    "geographic": makeInterpretations(options, selectedSteps, "geographic"),
    "tectonic": makeInterpretations(options, selectedSteps, "tectonic")
  });

  redrawCharts();

  saveLocalStorage();

}

function makeInterpretations(options, selectedSteps, reference) {

  /*
   * Function makeInterpretation
   * Does a PCA interpretation on the selected steps
   */

  var anchored = options.anchored;
  var type = options.type;

  var specimen = getSelectedSpecimen();

  var centerMass = new Array(0, 0, 0);

  var vectors = selectedSteps.map(function(step) {
    return inReferenceCoordinates(reference, specimen, new Coordinates(step.x, step.y, step.z)).toArray();
  });

  var first = vectors[0];
  var last = vectors[vectors.length - 1];

  // When anchoring we mirror the points and add them
  if(anchored) {
    vectors = vectors.concat(selectedSteps.map(function(step) {
      return new Array(-step.x, -step.y, -step.z);
    }));
  }

  // Transform to the center of mass (not needed when anchoring)
  if(!anchored) {
    for(var i = 0; i < vectors.length; i++) {
      for(var j = 0; j < 3; j++) {
        centerMass[j] += vectors[i][j] / selectedSteps.length;
      }
    }
    
    for(var i = 0; i < vectors.length; i++) {
      for(var j = 0; j < 3; j++) {
        vectors[i][j] = vectors[i][j] - centerMass[j];		
      }
    }
  }

  // Library call (numeric.js) to get the eigenvector / eigenvalues
  try {
    var eig = sortEig(numeric.eig(TMatrix(vectors)));
  } catch(exception) {
    throw(new Exception("Could not calculate the eigenvectors."));
  }

  // Extract all the steps used in the interpretation
  var stepValues = selectedSteps.map(x => x.step)
  var centerMassCoordinates = new Coordinates(...centerMass);

  // Dot product of principal eigen vector with vector pointing from first to last
  var control = eig.v1[0] * (first[0] - last[0]) + eig.v1[1] * (first[1] - last[1]) + eig.v1[2] * (first[2] - last[2]);

  if(control < 0) {
    eig.v1[0] = -eig.v1[0]
    eig.v1[1] = -eig.v1[1]
    eig.v1[2] = -eig.v1[2]
  }
 
  // Determine what eigenvector to use (tau1 for directions; tau3 for planes)
  switch(type) {

    case "TAU1":

      // Calculation of maximum angle of deviation
      var s1 = Math.sqrt(eig.tau[0]);
      var MAD = Math.atan(Math.sqrt(eig.tau[1] + eig.tau[2]) / s1);
	    	
      // Get the dec/inc of the maximum eigenvector stored in v1
      var eigenVectorCoordinates = new Coordinates(...eig.v1);

      var interpretation = new Interpretation(eigenVectorCoordinates, centerMassCoordinates, anchored, "TAU1", MAD, stepValues, reference);
      break;

    case "TAU3":

      // Calculation of maximum angle of deviation
      var s1 = Math.sqrt((eig.tau[2] / eig.tau[1]) + (eig.tau[2] / eig.tau[0]));
      var MAD = Math.atan(s1);
	    	
      // Get the coordinates of the maximum eigenvector stored in v3
      var eigenVectorCoordinates = new Coordinates(...eig.v3);
      
      // Always take the negative pole by convention
      if(eigenVectorCoordinates.z > 0) {
        eigenVectorCoordinates = eigenVectorCoordinates.reflect();
      }
      
      var interpretation = new Interpretation(eigenVectorCoordinates, centerMassCoordinates, anchored, "TAU3", MAD, stepValues, reference);
      break;

    default:
      throw(new Exception("Unknown interpretation type requested."));

  }

  return interpretation;

}

var Interpretation = function(coordinates, centerMass, anchored, type, MAD, steps, reference) {

  /*
   * Class Interpretation
   * Container for PCA interpretations (tau1, tau3)
   */

  if(isNaN(MAD)) {
    MAD = null;
  }

  return {
     "centerMass": centerMass,
     "x": coordinates.x,
     "y": coordinates.y,
     "z": coordinates.z,
     "MAD": MAD / RADIANS
   }

}

function normalizeEigenValues(eig) {

  /*
   * Function normalizeEigenValues
   * Modifies the eigen object in place and normalizes the eigenvalues to within [0, 1]
   */

  var trace = 0;

  // Get the trace of the matrix
  for(var i = 0; i < 3; i++) {
    trace += eig.lambda.x[i];
  }

  for(var i = 0; i < 3; i++) {
    eig.lambda.x[i] = eig.lambda.x[i] / trace;
  }

}

var sortEig = function (eig) {

  /*
   * Function sortEig
   * Description: sorts eigenvalues and corresponding eigenvectors from highest to lowest 
   * Input: numeric.js.eig output
   * Output: tau Array containing [t1, t2, t3] and sorted eigenvectors v1, v2, v3 from high to low
   */
  
  // Algorithm to sort eigenvalues and corresponding eigenvectors
  // as taken from the PmagPY library
  var t1 = 0;
  var t2 = 0;
  var t3 = 1;
  var ind1 = 0;
  var ind2 = 1;
  var ind3 = 2;

  // Normalize eigenvalues (impure)
  normalizeEigenValues(eig);

  //Determine what eigenvalues are largest and smallest
  for(var i = 0; i < 3; i++) {

    // Find the largest eigenvalue
    if(eig.lambda.x[i] > t1) {
      t1 = eig.lambda.x[i];
      ind1 = i;
    }

    // Find the smallest eigenvalue
    if(eig.lambda.x[i] < t3) {
      t3 = eig.lambda.x[i];
      ind3 = i;
    }

  }
  
  // Confirm the middle eigenvalue
  for(var i = 0; i < 3; i++) {
    if(eig.lambda.x[i] !== t1 && eig.lambda.x[i] !== t3) {
      t2 = eig.lambda.x[i];
      ind2 = i;
    }
  }
  
  // Sort eigenvectors
  // We need to sort the columns and not rows so slightly interesting shuffle
  return {
    "v1": new Array(eig.E.x[0][ind1], eig.E.x[1][ind1], eig.E.x[2][ind1]),
    "v2": new Array(eig.E.x[0][ind2], eig.E.x[1][ind2], eig.E.x[2][ind2]),
    "v3": new Array(eig.E.x[0][ind3], eig.E.x[1][ind3], eig.E.x[2][ind3]),
    "tau": new Array(t1, t2, t3)
  }

}

function TMatrix(data) {
	
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


// Components
var stepSelector = new StepSelector();

/* FUNCTION unblockingSpectrum
 * Description: calculates the unblocking spectrum
 * Input: Highcharts Intensity series
 * Output: Highcharts formatted array of the UBS
 */
function getUBS(intensityData) {

  // Determine the unblocking spectrum
  var UBS = new Array();
  for(var i = 1; i < intensityData.length + 1; i++) {
    if(i !== intensityData.length) {	
      UBS.push({
        "x": intensityData[i - 1].x,
	    "y": Math.abs(intensityData[i - 1].y - intensityData[i].y)
      });	
    }
  }

  // Add the first point
  if(UBS.length) {
    UBS.push({
      'x': intensityData[intensityData.length - 1].x,
      'y': UBS[UBS.length - 1].y
    });
  }

  return UBS;

}


function getVDS(intensityData) {

  /* Function vectorDifferenceSum
   * Calculates the vector difference sum
   */

  // Get the vector difference sum
  var VDS = new Array();

  for(var i = 1; i < intensityData.length + 1; i++) {

    var sum = 0;

    for(var j = i; j < intensityData.length + 1; j++) {

      if(j === intensityData.length) {
        sum += Math.abs(intensityData[j-1].y);
      } else {
        sum += Math.abs(intensityData[j-1].y - intensityData[j].y);
      }

    }

    VDS.push({
      "x": intensityData[i-1].x,
      "y": sum,
      "marker": intensityData[i-1].marker
    });

  }

  return VDS;

}

function plotIntensityDiagram(specimen) {

  /*
   * Function plotIntensityDiagram
   *
   */

  function normalize(intensities) {

    const NORMALIZE_INTENSITIES = true;
    
    // Normalize the intensities to the maximum resultant intensity
    if(NORMALIZE_INTENSITIES) {
      var normalizationFactor = Math.max.apply(null, intensities.map(x => x.y));
    } else {
      var normalizationFactor = 1;
    }
    
    return intensities.map(function(x) {
      return {
        "x": x.x,
        "y": x.y / normalizationFactor,
        "marker": x.marker
      }
    });

  }

  var intensities = new Array();

  specimen.steps.forEach(function(step, i) {

    // On show steps that are visible
    //Remove mT, μT, C or whatever from step - just take a number
    if(step.visible) {

      // Get the treatment step as a number
      var treatmentStep = Number(step.step.replace(/[^0-9.]/g, ""));

      if(stepSelector._selectedStep === i) {
        var marker = {"radius": MARKER_RADIUS_SELECTED}
      } else {
        var marker = {"radius": MARKER_RADIUS}
      }

      marker.symbol = "circle";

      intensities.push({
        "x": treatmentStep, 
        "y": new Coordinates(step.x, step.y, step.z).length,
        "marker": marker,
        "stepIndex": i
      });

    }

  });

  var normalizedIntensities = normalize(intensities);

  // Get the unblocking spectrum (UBS) and vector difference sum (VDS)
  var plotSeries = new Array({
    "name": 'Resultant Intensity',
    "data": normalizedIntensities,
    "zIndex": 10
  }, {
    "name": 'Vector Difference Sum',
    "data": getVDS(normalizedIntensities),
    "zIndex": 10
  }, {
    "type": "area",
    "step": true,
    "pointWidth": 50,
    "name": "Unblocking Spectrum",
    "marker": {
      "enabled": false,
      "symbol": "circle"
    },
    "data": getUBS(normalizedIntensities),
    "zIndex": 0
  });

  createIntensityDiagram(specimen, plotSeries);
 
}

function exportApplicationSave() {

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

function downloadAsJSON() {

  /*
   * Function downloadAsJSON
   * Generates JSON representation of station table
   */

  const MIME_TYPE = "data:application/json;charset=utf-8";
  const FILENAME = "specimens.dir";

  if(samples.length === 0) {
    return notify("danger", new Exception("No specimens to export"));
  }

  var payload = encodeURIComponent(JSON.stringify(samples));

  downloadURIComponent(FILENAME, MIME_TYPE + "," + payload);

}

function downloadInterpretations() {

  const FILENAME = "interpretations.csv";

  const CSV_HEADER = new Array(
    "Sample Name",
    "Reference",
    "Declination",
    "Inclination",
    "MAD",
    "anchored",
    "type",
    "created"
  );

  if(samples.length === 0) {
    return notify("danger", new Exception("No interpretations available to export."));
  }

  var rows = new Array(CSV_HEADER.join(","));

  samples.forEach(function(specimen) {
    specimen.interpretations.forEach(function(interpretation) {
      var direction = new Coordinates(interpretation.geographic.x, interpretation.geographic.y, interpretation.geographic.z).toVector(Direction);
      rows.push(new Array(specimen.name, "geographic", direction.dec, direction.inc, interpretation.geographic.MAD, interpretation.anchored, interpretation.type, interpretation.created).join(","));
    });
  });

  if(rows.length === 1) {
    return notify("danger", new Exception("No interpretations available to export."));
  }

  downloadAsCSV(FILENAME, rows.join(LINE_DELIMITER));

}

function downloadAsCSV(filename, csv) {

  const MIME_TYPE = "data:text/csv;charset=utf-8";

  downloadURIComponent(filename, MIME_TYPE + "," + encodeURIComponent(csv));

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
      case "application/json":
      case "application/vnd.schemaorg.ld+json":
        return callback(JSON.parse(xhr.response));
      default:
        return callback(xhr.response);
    }

  }

  xhr.onerror = function(error) {
    callback(null);
  }

  // Open and finish the request
  xhr.open(type, url);
  xhr.send();

}

function getPublicationFromPID() {

  /*
   * Function getPublicationFromPID
   * Returns the resource that belogns to the PID
   */

  // Get the publication from the URL
  var SHA256 = location.search.substring(1);
  
  if(!PUBLICATIONS.hasOwnProperty(SHA256)) {
    notify("danger", "Data from this persistent identifier could not be found.");
  }

  // Request the persistent resource from disk
  HTTPRequest("./publications/" + SHA256 + ".pid", "GET", __unlock__);
  
}

function __unlock__(json) {

  samples = JSON.parse(json);

  notify("success", "Welcome back! Succesfully loaded <b>" + samples.length + "</b> specimens from local storage.");

  updateSelect();
  stepSelector.reset();

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
  samples = localStorage.getItem("specimens");

  if(samples === null) {
    samples = new Array();
    return notify("warning", "Welcome to <b>Paleomagnetism.org</b>. No specimens are available. Add data to begin.");
  }

  __unlock__(samples);

}

__init__();
