// Reveal

/////////// Read and process files ///////////
const fileSelector = document.getElementById('file-selector');
fileSelector.addEventListener('change', (event) => {
  const fileList = event
    .target.files;
  console.log(fileList);
  for (const file of fileList) {
    readFile(file);
  }
});


function handleDrop(event) {
  event.preventDefault();
  document.getElementById('drop-zone').classList.remove('pale');
  var file = event.dataTransfer.files[0];

  if (file.name.endsWith('.sgn')) {
    readFileSGN(file);
  } else {
    readFile(file);
  }
  //document.getElementById('drop_zone').style.display = 'none';
}

function handleDragOver(event) {
  event.preventDefault();
  //event.target.style.backgroundColor = "#59F2F7";
  document.getElementById('drop-zone').classList.add('pale');
}

function handleDragLeave(event) {
  event.preventDefault();
  //event.target.style.backgroundColor = "#59F2F7";
  document.getElementById('drop-zone').classList.remove('pale');
}

function readFileSGN(file) {
  const reader = new FileReader();

  reader.onload = (event) => {
    const fileContent = event.target.result;
    const rows = parseSGNFile(fileContent);
    console.log("Parsed Data:", rows);
  };

  reader.onerror = (event) => {
    console.error("Error reading file:", event.target.error);
  };

  reader.readAsText(file); // Read the file as plain text
}

function parseSGNFile(fileContent) {
  const tempRows = {}; // Temporary object to store data before reordering
  let timeVector = []; // Separate variable to hold TIME vector

  // Split the file into lines
  const lines = fileContent.split("\n");

  let currentChannel = null;
  let isParsingNumbers = false;
  let metadata = {};
  let numbers = [];
  let samplingTime = 0;
  let timeVectorAdded = false; // Ensure TIME is added only once

  for (let line of lines) {
    line = line.trim(); // Remove extra whitespace

    // Skip empty lines
    if (!line) continue;

    // Detect a channel start
    if (line.startsWith("=====")) {
      if (currentChannel && numbers.length > 0) {
        tempRows[currentChannel] = numbers;

        // If TIME vector hasn't been added, create it for the first signal
        if (!timeVectorAdded) {
          timeVectorAdded = true;
          if (samplingTime > 0) {
            timeVector = Array.from({ length: numbers.length }, (_, i) => i * samplingTime);
          } else {
            console.warn("Sampling Time not found for the first signal. TIME vector cannot be created.");
          }
        }
      }
      currentChannel = null;
      isParsingNumbers = false;
      numbers = [];
      metadata = {};
      continue;
    }

    // Parse metadata section
    if (line.startsWith("{")) {
      metadata = {};
      continue;
    }

    if (line.startsWith("}")) {
      isParsingNumbers = true;

      // Capture Sampling Time from metadata for the first signal
      if (!timeVectorAdded && metadata["Sampling Time"]) {
        samplingTime = metadata["Sampling Time"];
      }
      continue;
    }

    if (isParsingNumbers) {
      // Parse numerical data
      const values = line.split(/\s+/).map(Number);
      numbers.push(...values);
    } else {
      // Parse metadata entries
      const [key, value] = line.split("=");
      if (key && value) {
        metadata[key.trim()] = isNaN(value.trim()) ? value.trim() : parseFloat(value.trim());
      }

      if (key.trim() === "Name") {
        currentChannel = value.trim(); // Use the 'Name' field as the channel identifier
      }
    }
  }

  // Handle the last channel
  if (currentChannel && numbers.length > 0) {
    tempRows[currentChannel] = numbers;

    // Add TIME vector for the first signal if it hasn't been added
    if (!timeVectorAdded && samplingTime > 0) {
      timeVector = Array.from({ length: numbers.length }, (_, i) => i * samplingTime);
    }
  }

  // Create a new object to ensure TIME is the first property
  const rows = { TIME: timeVector };
  Object.assign(rows, tempRows); // Merge other channels into the rows object

  window.rows = rows;
  //return rows;
}


function readFile(file) {
  //console.log(file);

  const reader = new FileReader();
  reader.addEventListener('load', (event) => {
    ttt = Plotly.d3.text(event.target.result, function (text) {
      resultlines = text.split(/[\r\n]+/);
      const { header, startIdx } = getHeader(resultlines);
      //console.log(header);
      //console.log(startIdx);

      //nums.push(resultlines.forEach(parseLine));	
      rows = defineObj(header);
      for (var i = startIdx; i < resultlines.length; i++) {
        var tLine = parseLine(resultlines[i]);
        if (tLine.length >= header.length) {
          //if (tLine.length == header.length) {
          for (var j = 0; j < header.length; j++) {
            rows[header[j]].push(tLine[j]);
          }
        }
      }

      //processData(rows);
      processData();
      window.rows = rows;
      //return nums;
    });

    function parseLine(row) {
      //num = row.split(",").map(Number);
      num = row.split(",");
      //nums = row.split(",").filter(x => x.trim().length && !isNaN(x)).map(Number)
      //console.log(nums);
      return num;
    };

    function getHeader(resultlines) {

      headerObj = {};

      for (var i = 0; i < 50; i++) {
        var tLine = parseLine(resultlines[i]);
        if (tLine.length > 1 && isNaN(tLine[1])) {
          headerObj.header = verifyGoodName(tLine);
          headerObj.startIdx = i + 1;
          //return headerObj;
          break;
        };
      };

      /*if (tLine.length != headerObj.header.length) { // No header
        headerObj = header4noHeader(tLine.length);
      }*/


      return headerObj;
    };

    function headerFromUser(headerObj) {

      headerObj.header = [];
      var tLine = parseLine(document.getElementById("labelsInput").value);
      if (tLine.length > 2 && isNaN(tLine[1])) {
        headerObj.header = verifyGoodName(tLine);
        headerObj.startIdx = 0;
        return headerObj;
      }
    }

    function defineObj(header) {

      var obj = {};
      for (var i = 0; i < header.length; i++) {
        obj[header[i]] = [];
      };
      return obj;
    };

    function verifyGoodName(name) {
      name = name.map(element => element.replace(' ', ''));
      return name;
    }

    //plotFromCSV(event.target.result);
  });
  reader.readAsDataURL(file);
}
/////////// End of Read and process files ///////////


/////////// Ploting Functions ///////////

function createPlotlyTable(m, n, containerId) {
  const container = document.getElementById(containerId);

  // Remove any existing table in the container
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const table = document.createElement('table');
  const plotHandles = [];

  for (let i = 0; i < m; i++) {
    const row = document.createElement('tr');
    const rowHandles = [];

    for (let j = 0; j < n; j++) {
      const cell = document.createElement('td');
      const plotDiv = document.createElement('div');
      plotDiv.id = `plot-${i}-${j}`;
      plotDiv.className = 'plot-container';
      cell.appendChild(plotDiv);
      row.appendChild(cell);

      rowHandles.push(plotDiv);
    }

    table.appendChild(row);
    plotHandles.push(rowHandles);
  }

  // Append the new table to the designated container
  container.appendChild(table);

  return plotHandles;
}

function plotlyTableToDiscrete(plotHandles) {
  plotHandles.forEach((row) => {
    row.forEach((plotDiv) => {
      const update = {
        'yaxis.type': 'category'
      };
      Plotly.relayout(plotDiv.id, update);
    });
  });
}


function plot(plotHandles, rowIndex, colIndex, xData, yData, traceName = null, title, xLabel, yLabel, color = null, showLeg = true, mode = 'lines') {
  if (rowIndex >= plotHandles.length || colIndex >= plotHandles[rowIndex].length) {
    console.error('Invalid cell index');
    return;
  }

  yData = yLabel.includes('deg') ? mult(yData, r2d) : yData; // Change units r2d

  const plotDiv = plotHandles[rowIndex][colIndex];
  const trace = {
    x: xData,
    y: yData,
    mode: mode,
    marker: color ? { color: color } : {},
    showlegend: showLeg
  };
  if (traceName !== null) {
    trace.name = traceName;
  }
  const layout = {
    title: title,
    xaxis: {
      title: xLabel
    },
    yaxis: {
      title: yLabel,
    },
    legend: {
      x: 1,
      y: 1,
      xanchor: 'right'
    }
  };

  const config = {
    editable: true
  };

  // Check if the plot already exists
  if (plotDiv.data) {
    // Add new trace to the existing plot
    Plotly.addTraces(plotDiv.id, trace);
  } else {
    // Create a new plot if it doesn't exist
    Plotly.newPlot(plotDiv.id, [trace], layout, config);
  }
}


function addLimitLine(plotHandles, rowIndex, colIndex, val, dashed = 'solid') {
  if (rowIndex >= plotHandles.length || colIndex >= plotHandles[rowIndex].length) {
    console.error('Invalid cell index');
    return;
  }

  const plotDiv = plotHandles[rowIndex][colIndex];
  val = val;

  var lim1 = {
    x: plotDiv.layout.xaxis.range,
    y: [val, val],
    name: 'Limit',
    mode: 'lines',
    line: {
      color: 'Red',
      width: 2,
      dash: dashed
    },
    showlegend: false,
  }
  Plotly.addTraces(plotDiv.id, lim1);
  //return lim1;
}


function addLimitLinesIfNear(plotHandles, rowIndex, colIndex, signal, limit1, limit2) {

  if (signal.some(value => Math.sign(value) == Math.sign(limit1))) {
    addLimitLine(plotHandles, rowIndex, colIndex, limit1);
  }
  if (signal.some(value => Math.sign(value) == Math.sign(limit2))) {
    addLimitLine(plotHandles, rowIndex, colIndex, limit2);
  }
}

function addDivider(plotHandles, rowIndex, colIndex, val, name = 'devider', dashed = 'dashed') {
  if (rowIndex >= plotHandles.length || colIndex >= plotHandles[rowIndex].length) {
    console.error('Invalid cell index');
    return;
  }

  const plotDiv = plotHandles[rowIndex][colIndex];

  var divide1 = {
    x: [val, val],
    y: plotDiv.layout.yaxis.range,
    name: name,
    mode: 'lines',
    line: {
      color: 'forestgreen',
      width: 2,
      dash: dashed
    },
    showlegend: false,
  }
  Plotly.addTraces(plotDiv.id, divide1);
  //return lim1;
}

/////////// End of Ploting Functions ///////////


/////////// Show Results table Functions ///////////

function drawTable(data) {
  const table = document.getElementById('resultsTable');

  if (!table) {
    console.error('Table not found');
    return;
  }

  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const headers = ['Parameter', 'X', 'Y', 'Success Criteria'];
  const headerRow = document.createElement('tr');

  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.textAlign = 'center';  // Center-align headers
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  data.forEach(item => {
    const row = document.createElement('tr');
    const cells = [item.parameter, item.value1.toFixed(2), item.value2.toFixed(2), item.successCriteria];

    cells.forEach((cellValue, index) => {
      const td = document.createElement('td');
      td.textContent = cellValue;
      td.style.textAlign = 'center';  // Center-align cell values

      if (index > 0 && index < 3) { // Check only for Traverese and Elevation columns
        if (Math.abs(cellValue) > item.successCriteria) {
          td.style.color = 'red';
        } else {
          td.style.color = 'green';
        }
      }

      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
}

function drawTableOneCol(data) {
  const table = document.getElementById('resultsTable');

  if (!table) {
    console.error('Table not found');
    return;
  }

  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const headers = ['Parameter', 'Value', 'Success Criteria'];
  const headerRow = document.createElement('tr');

  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    th.style.textAlign = 'center';  // Center-align headers
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  data.forEach(item => {
    const row = document.createElement('tr');
    const cells = [item.parameter, item.value1.toFixed(2), item.successCriteria.toFixed(2)];

    cells.forEach((cellValue, index) => {
      const td = document.createElement('td');
      td.textContent = cellValue;
      td.style.textAlign = 'center';  // Center-align cell values

      if (item.successMethod === 'bigger')
        success = item.value1 > item.successCriteria;

      if (item.successMethod === 'smaller')
        success = item.value1 < item.successCriteria;


      if (index == 1) { // Check only for value column
        if (success) {
          td.style.color = 'green';
        } else {
          td.style.color = 'red';
        }
      }

      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
}


/////////// End of Results Table Functions ///////////


/////////// Set Limits Functions ///////////

document.addEventListener('DOMContentLoaded', (event) => {
  loadParameters();
});

function openLimitsModal() {
  document.getElementById("limitsModal").style.display = "block";
}

function closeLimitsModal() {
  document.getElementById("limitsModal").style.display = "none";
}

function submitForm() {
  const LimitTr1 = document.getElementById("LimitTr1").value;
  const LimitTr2 = document.getElementById("LimitTr2").value;
  const LimitEl1 = document.getElementById("LimitEl1").value;
  const LimitEl2 = document.getElementById("LimitEl2").value;

  if (LimitTr1 && LimitTr2 && LimitEl1 && LimitEl2) {
    saveParameters(LimitTr1, LimitTr2, LimitEl1, LimitEl2);
    //alert(`Traverse Limit 1: ${LimitTr1}\nTraverse Limit 2: ${LimitTr2}\nElevation Limit 1: ${LimitEl1}\nElevation Limit 2: ${LimitEl2}`);
    closeLimitsModal();
  } else {
    alert("All parameters are required!");
  }
}

function saveParameters(LimitTr1, LimitTr2, LimitEl1, LimitEl2) {
  localStorage.setItem('LimitTr1', LimitTr1);
  localStorage.setItem('LimitTr2', LimitTr2);
  localStorage.setItem('LimitEl1', LimitEl1);
  localStorage.setItem('LimitEl2', LimitEl2);
}

function loadParameters() {
  const LimitTr1 = localStorage.getItem('LimitTr1') || "-60";
  const LimitTr2 = localStorage.getItem('LimitTr2') || "60";
  const LimitEl1 = localStorage.getItem('LimitEl1') || "-30";
  const LimitEl2 = localStorage.getItem('LimitEl2') || "60";

  document.getElementById('LimitTr1').value = LimitTr1;
  document.getElementById('LimitTr2').value = LimitTr2;
  document.getElementById('LimitEl1').value = LimitEl1;
  document.getElementById('LimitEl2').value = LimitEl2;
}

function getLimits() {

  // Example usage:
  // const limits = getLimits();
  // console.log(`Traverse Limit 1: ${limits.LimitTr1}`

  const LimitTr1 = d2r * localStorage.getItem('LimitTr1') || "-60";
  const LimitTr2 = d2r * localStorage.getItem('LimitTr2') || "60";
  const LimitEl1 = d2r * localStorage.getItem('LimitEl1') || "-30";
  const LimitEl2 = d2r * localStorage.getItem('LimitEl2') || "60";

  return { LimitTr1, LimitTr2, LimitEl1, LimitEl2 };
}

/////////// End of Set Limits Functions ///////////


function replacePic(newPicTag) {
  //document.getElementById('picture_main').src = './images/show_sensors.png';
  pictureElement = document.getElementById('picture_main');
  const sources = pictureElement.getElementsByTagName('source');
  const img = document.getElementById('img_main');
  sources[0].srcset = newPicTag;
  sources[1].srcset = newPicTag;
  sources[2].srcset = newPicTag;
  img.onload = function () {
    img.width = img.naturalWidth * 1.5;
    img.height = img.naturalHeight * 1.5;
    console.log(`Image width set to: ${img.width}px`);
  };
  console.log("switched");
}


// Set pressed button color to active
let previousLink = null;

document.querySelectorAll('.button').forEach(link => {
  link.addEventListener('click', function (event) {
    event.preventDefault(); // Prevent the default link behavior

    // Reset the previous link's color
    if (previousLink) {
      previousLink.classList.remove('active');
    }

    // Set the current link's color
    this.classList.add('active');

    // Update the previous link
    previousLink = this;
  });
});
// End of Set pressed button color to active

function ShowSensors() {

  cleanUp();

  const pl = createPlotlyTable(Object.keys(rows).length - 1, 1, 'plot-area');

  Object.keys(rows).forEach((key, index) => {
    if (key !== 'TIME') {
      plot(pl, index - 1, 0, rows.TIME, rows[key], traceName = key, title = key, "", "Value");
    }
  });
}


function NaturalFreq() {
  cleanUp();

  const crossingFreq = vector => {
    Ts = 0.05e-3;
    const crossings = vector.reduce((acc, _, i) => i > 0 && ((vector[i - 1] > 0 && vector[i] < 0) || (vector[i - 1] < 0 && vector[i] > 0)) ? [...acc, i] : acc, []);

    let crossTime;
    if (crossings.length >= 8) {
        const selectedCrossings = crossings.slice(1, 8);
        const differences = selectedCrossings.map((val, idx) => val - selectedCrossings[idx - 1]).slice(1); 
        crossTime = mean(differences);
    }
    const frq = crossTime ? 1 / (2 * Ts * crossTime) : undefined;
    return frq;
  };

  const results = [
    { parameter: 'Natural Frequency', value1: crossingFreq(rows.FVEL), successCriteria: 200, successMethod: 'bigger' }
  ];
  drawTableOneCol(results);

  const pl = createPlotlyTable(1, 1, 'plot-area');
  plot(pl, 0, 0, rows.TIME, rows.FVEL, traceName = 'Velocity', title = 'Natural Frequency', xLabel = 'Time', yLabel = 'Velocity');

}



function CommandVelocity() {

  cleanUp();

  // Find min and max DOUT values where abs(FVEL) < 1
  const filteredDOUT = rows.DOUT.filter((val, i) => Math.abs(rows.FVEL[i]) < 1);
  const minDOUT = Math.min(...filteredDOUT);
  const maxDOUT = Math.max(...filteredDOUT);

  const results = [
    { parameter: 'Negative Minimal Command', value1: minDOUT, successCriteria: 8, successMethod: "smaller" },
    { parameter: 'Positive Minimal Command', value1: maxDOUT, successCriteria: 10, successMethod: "bigger" },
  ];
  drawTableOneCol(results);

  const pl = createPlotlyTable(1, 1, 'plot-area');
  plot(pl, 0, 0, rows.DOUT, rows.FVEL, traceName = 'Command - Velocity', title = 'Command - Velocity', xLabel = 'DOUT', yLabel = 'FVEL', color = null, showLeg = false, mode = 'markers');
  addDivider(pl, 0, 0, minDOUT);
  addDivider(pl, 0, 0, maxDOUT);
}

function CommandPosition() {
  cleanUp();

  // Get positive and negative DOUT values and their corresponding FPOS values
  const positivePairs = rows.DOUT.map((dout, i) => ({ dout: parseFloat(dout), fpos: parseFloat(rows.FPOS[i]) }))
    .filter(pair => pair.dout > 0 && !isNaN(pair.dout) && !isNaN(pair.fpos));
  const negativePairs = rows.DOUT.map((dout, i) => ({ dout: parseFloat(dout), fpos: parseFloat(rows.FPOS[i]) }))
    .filter(pair => pair.dout < 0 && !isNaN(pair.dout) && !isNaN(pair.fpos));

  // Sort FPOS values to find ranges
  const positiveSortedFPOS = positivePairs.map(pair => pair.fpos).sort((a, b) => a - b);
  const negativeSortedFPOS = negativePairs.map(pair => pair.fpos).sort((a, b) => a - b);

  const posLen = positiveSortedFPOS.length;
  const negLen = negativeSortedFPOS.length;

  // Get middle 90% range of FPOS values for both positive and negative
  const posLowerBound = positiveSortedFPOS[Math.floor(posLen * 0.1)] || 0;
  const posUpperBound = positiveSortedFPOS[Math.floor(posLen * 0.9)] || 0;

  const negLowerBound = negativeSortedFPOS[Math.floor(negLen * 0.1)] || 0;
  const negUpperBound = negativeSortedFPOS[Math.floor(negLen * 0.9)] || 0;

  // Filter pairs within FPOS ranges and find min positive DOUT and max negative DOUT
  const minPositiveDOUT = positivePairs.length ? Math.min(...positivePairs
    .filter(pair => pair.fpos >= posLowerBound && pair.fpos <= posUpperBound)
    .map(pair => pair.dout)) : 0;

  const maxNegativeDOUT = negativePairs.length ? Math.max(...negativePairs
    .filter(pair => pair.fpos >= negLowerBound && pair.fpos <= negUpperBound)
    .map(pair => pair.dout)) : 0;

  const results = [
    { parameter: 'Minimal Positive Command', value1: minPositiveDOUT, successCriteria: 25, successMethod: "bigger" },
    { parameter: 'Maximal Negative Command', value1: maxNegativeDOUT, successCriteria: -25, successMethod: "smaller" }
  ];
  drawTableOneCol(results);

  const pl = createPlotlyTable(1, 1, 'plot-area');
  plot(pl, 0, 0, rows.FPOS, rows.DOUT, traceName = 'Command - Position', title = 'Command - Position', xLabel = 'FPOS', yLabel = 'DOUT', color = null, showLeg = false, mode = 'markers');

  addLimitLine(pl, 0, 0, minPositiveDOUT);
  addLimitLine(pl, 0, 0, maxNegativeDOUT);
}


function Stabilization() {
  cleanUp();
  
  const results = [
    { parameter: 'Max. Movement', value1: max(rows.FPOS) - min(rows.FPOS), successCriteria: 25, successMethod: "bigger" },
    { parameter: 'Position Error STD', value1: std(rows.PE), successCriteria: 1, successMethod: "bigger" }
  ];
  drawTableOneCol(results);

  const pl = createPlotlyTable(2, 1, 'plot-area');
  plot(pl, 0, 0, rows.TIME, rows.FPOS, traceName = 'Position', title = 'Position', xLabel = 'Time [ms]', yLabel = 'FPOS [mm]', color = null, showLeg = false);
  plot(pl, 1, 0, rows.TIME, rows.PE, traceName = 'Position Error', title = 'Position Error', xLabel = 'Time [ms]', yLabel = 'PE [mm]', color = null, showLeg = false);
}


function drift() {
  cleanUp();

  // Create an img element
  const img = document.createElement('img');
  img.src = 'images/drift.gif';
  img.style.width = '50%';
  img.style.height = '50%';
  img.style.objectFit = 'contain';

  // Get the plot area div and clear it
  const plotArea = document.getElementById('plot-area');
  plotArea.innerHTML = '';

  // Add the image to the plot area
  plotArea.appendChild(img);
}


function addLine(vName, ax_y = 1, ax_x = 1, factor = 1, showName, showLeg = true, allRows) {

  if (showName === undefined) {
    showName = vName.replace(/_/g, " ");
  }

  let x = [];
  let y = [];

  var x_axis = "time";
  x = rows[x_axis];
  y = mult(rows[vName], factor);
  var trace = {
    x: x,
    y: y,
    xaxis: 'x' + ax_x,
    yaxis: 'y' + ax_y,
    name: showName,
    type: 'scatter',
    showlegend: showLeg,
  };
  if (!showLeg) {
    trace.line = {
      color: 'Red',
      width: 2,
    };
  }
  return trace;
}
//plotFromCSV();


function addLimitLineTraces(ax_y = 1, ax_x = 1, val) {

  var lim1 = {
    x: [window.rows["time"][0], window.rows["time"].slice(-1)[0]],
    y: [val, val],
    xaxis: 'x' + ax_x,
    yaxis: 'y' + ax_y,
    name: 'Limit',
    mode: 'line',
    line: {
      color: 'Red',
      width: 2,
    },
    showlegend: false,
  }
  return lim1;
}

function addLineBin(vName, ax, allRows) {
  let x = [];
  let y = [];

  var x_axis = "time";
  x = rows[x_axis];
  y = rows[vName];
  var trace = {
    x: x,
    y: y,
    yaxis: 'y' + ax,
    name: vName,
    type: 'scatter',
  };
  return trace;
}

function plotTraces(traces, sp_r = 2, sp_c = 1) {
  var layout = {
    height: window.innerHeight,
    title: {
      text: this.fileName,
      font: {
        size: 24
      },
    },
    grid: {
      rows: sp_r,
      columns: sp_c,
      pattern: 'coupled',
    },
    yaxis: { title: 'Y Axis 1' },
    yaxis2: { title: 'Y Axis 2' },
    annotation: [
      {
        xref: 'paper',
        yref: 'paper',
        x: 0,
        xanchor: 'right',
        y: 1,
        yanchor: 'bottom',
        text: 'test',
        showarrow: false
      }
    ],
    showlegend: false
  };

  //https://plot.ly/javascript/configuration-options/
  let config = {
    responsive: true,
    // staticPlot: true,
    // editable: true
  };

  Plotly.newPlot("plot-area", traces, layout, { editable: true });
}


function processData() {

}


function cleanUp() {
  try {
    var explenation_text = document.getElementById("explenation_text");
    explenation_text.style.display = "none";

    const table = document.getElementById('resultsTable');
    // Remove any existing table in the container
    while (table.firstChild) {
      table.removeChild(table.firstChild);
    }

  } catch (error) { };



}

function menuItemExecute(caller, action) {
  // console.log(caller + " " + action);
  switch (action) {
    case "Rename":
      renameVar(caller);
      break;

    case "Mult":
      var factor = prompt(caller + " x ? ", 0.01);
      if (factor !== null) {
        newVarName = strClean(caller + "_x_" + factor);
        window.rows[newVarName] = mult(window.rows[caller], factor);
        addCheckbox(newVarName);
      }
      break;

    case "Diff":
      window.rows[caller + "_diff"] = diff(window.rows[caller]);
      addCheckbox(caller + "_diff");
      break;

    case "Integrate":
      window.rows[caller + "_int"] = integrate(window.rows[caller]);
      addCheckbox(caller + "_int");
      break;

    case "filter":
      var filter_w = prompt("LPF Cutoff Frequency? [Hz] ", 5);
      if (filter_w !== null) {
        window.rows[caller + "_filter"] = filter(window.rows[caller], filter_w);
        addCheckbox(caller + "_filter");
      }
      break;

    case "Detrend":
      window.rows[caller + "_detrend"] = detrend(window.rows[caller]);
      addCheckbox(caller + "_detrend");
      break;

    case "removeFirst":
      window.rows[caller + "_rem1"] = removeFirst(window.rows[caller]);
      addCheckbox(caller + "_rem1");
      break;

    case "removeMean":
      window.rows[caller + "_remMean"] = removeMean(window.rows[caller]);
      addCheckbox(caller + "_remMean");
      break;

    case "fixAngle":
      window.rows[caller + "_angFix"] = fixAngle(window.rows[caller]);
      addCheckbox(caller + "_angFix");
      break;

    case "showStat":
      showStat();
      break;

    case "cutToZoom":
      cutToZoom();
      break;

    case "dataTips":
      markDataTips();
      break;
  }
};

function renameVar(oldName) {
  var newName = prompt("Please enter new variable name", oldName);
  if (newName != null && newName !== oldName) {
    window.rows[newName] = window.rows[oldName];
    delete window.rows[oldName];
    toChange = document.getElementById(oldName);
    toChange.innerHTML = toChange.innerHTML.replaceAll(oldName, newName);
    toChange.onclick = sel;
  };
};

function showStat() {
  var gd = document.getElementById('plot')
  var xRange = gd.layout.xaxis.range
  try {
    var yRange = gd.layout.yaxis.range
  } catch {
    var yRange = gd.layout.yaxis2.range
  }
  var x_axis = document.getElementById("x_axis").value;

  var xIdx = [];
  if (typeof rows[x_axis][2] == 'string') {
    xIdx[0] = rows[x_axis][Math.floor(xRange[0])];
    xIdx[1] = rows[x_axis][Math.floor(xRange[1])];
  } else {
    xIdx = xRange;
  }

  var stat = {
    Name: [],
    Mean: [],
    STD: [],
    Min: [],
    Max: []
  }

  gd.data.forEach(trace => {
    var len = Math.min(trace.x.length, trace.y.length)
    var xInside = []
    var yInside = []

    for (var i = 0; i < len; i++) {
      var x = trace.x[i]
      var y = trace.y[i]

      if (x > xIdx[0] && x < xIdx[1] && y > yRange[0] && y < yRange[1]) {
        xInside.push(x)
        yInside.push(y)
      }
    }
    stat.Name.push(trace.name);
    stat.Mean.push(mean(yInside));
    stat.STD.push(std(yInside));
    stat.Min.push(Math.min(...yInside));
    stat.Max.push(Math.max(...yInside));
  })

  //let str = JSON.stringify(stat, null, 2);
  alert(niceStr(stat));


  function niceStr(stat) {
    //console.log(stat);
    let str = '';
    console.log(stat.Mean.length);
    for (var i = 0; i < stat.Mean.length; i++) {
      str += stat.Name[i] + ': \n';
      str += 'Min: ' + stat.Min[i].toFixed(3) + '\n';
      str += 'Max: ' + stat.Max[i].toFixed(3) + '\n';
      str += 'Mean: ' + stat.Mean[i].toFixed(3) + '\n';
      str += 'STD: ' + stat.STD[i].toFixed(3) + '\n\n';
      console.log(str);
    }
    return str;
  }
}

function cutToZoom() {
  var gd = document.getElementById('plot')
  var xRange = gd.layout.xaxis.range
  //console.log(xRange);
  var x_axis = document.getElementById("x_axis").value;

  var idx = [];
  if (typeof rows[x_axis][2] !== 'string') {
    idx[0] = rows[x_axis].findIndex((val) => val > xRange[0]);
    idx[1] = rows[x_axis].findIndex((val) => val > xRange[1]);
  } else {
    idx = xRange;
  }
  let fields = Object.keys(rows);

  fields.forEach(field => rows[field] = rows[field].slice(idx[0], idx[1]));

  sel();
}

function relativeTime() {
  rows["time"].map
}

function markDataTips() {

  /*const container = document.getElementById('plot-area');
  const children = container.querySelectorAll('.plot-container');

  children.forEach(child => {
    // Do something with each child
    //console.log(child);

    try{
  //var myPlot = document.getElementById('plot-area');
  myPlot = child;
  myPlot.on('plotly_click', function (data) {
    var pts = '';
    for (var i = 0; i < data.points.length; i++) {
      annotate_text = 'x = ' + data.points[i].x +
        ', y = ' + data.points[i].y.toPrecision(4);
      annotation = {
        text: annotate_text,
        x: data.points[i].x,
        y: parseFloat(data.points[i].y.toPrecision(4)),
        xref: data.points[0].xaxis._id,
        yref: data.points[0].yaxis._id
      }
      annotations = plot.layout.annotations || [];
      annotations.push(annotation);

      Plotly.relayout('plot-area', { annotations: annotations })
    }
  });
} catch {console.log(child)};
});*/
}


////////////////////////////// Math Operations //////////////////////////////
function diff(y, x) {
  let Ts = 0.01;
  let d = [];
  for (i = 1; i < y.length; i++) {
    d[i] = (Number(y[i]) - Number(y[i - 1])) / Ts;
  }
  d[0] = d[1];
  return d;
}

function integrate(y, x) {
  let Ts = 0.01;
  let yInt = [];
  yInt[0] = parseFloat(y[0]);
  for (i = 1; i < y.length; i++) {
    yInt[i] = yInt[i - 1] + Ts * parseFloat(y[i]);
  }
  return yInt;
}

function filter(y, ws) {
  let Ts = 0.01;
  w = parseFloat(ws);
  console.log(w)
  /*let N0 = 0.0198250831839801;
  let N1 = 0.0396501663679602;
  let N2 = 0.0198250831839801;
  let D1 = -1.56731054883897;
  let D2 = 0.646610881574895;*/
  const pi = 3.1416;
  let D0 = pi ** 2 * w ** 2 + 140 * pi * w + 10000;
  let D1 = (2 * pi ** 2 * w ** 2 - 20000) / D0;
  let D2 = (pi ** 2 * w ** 2 - 140 * pi * w + 10000) / D0;
  let N0 = (w ** 2 * pi ** 2) / D0;
  let N1 = (2 * w ** 2 * pi ** 2) / D0;
  let N2 = N0;

  console.log(N0);
  console.log(N1);
  console.log(N2);
  console.log(D1);
  console.log(D2);


  //〖yf〗_k=N_0 y_k+N_1 y_(k-1)+N_2 y_(k-2)- D_1 〖yf〗_(k-1)-D_2 〖yf〗_(k-2)
  let yf = [];
  for (i = 0; i < y.length; i++) {
    yf[i] = ((i >= 2) ? parseFloat(N0 * y[i] + N1 * y[i - 1] + N2 * y[i - 2] - D1 * yf[i - 1] - D2 * yf[i - 2]) : parseFloat(y[i]));
  }
  //yf = y.map((item, i) => (i>=2) ? parseFloat(N0*y[i] + N1*y[i-1] + N2*y[i-2] - D1*yf[i-1] - D2*yf[i-2]) : parseFloat(y[i]) );
  //yf = y.map((item, i) => (i>=2) ? parseFloat(7) : parseFloat(y[i]) );

  return yf;
}

function detrend(y, x) {
  let a = (parseFloat(y[y.length - 1]) - parseFloat(y[0])) / (y.length - 1);
  let yd = y.map((item, i) => parseFloat(y[i]) - a * i);
  return yd;
}

function fixAngle(y, x) {
  let yo = [];
  let bias = 0;
  yo[0] = y[0];
  for (i = 1; i < y.length; i++) {
    bias += (y[i] - y[i - 1] > 300) ? -360 : 0;
    bias += (y[i] - y[i - 1] < -300) ? 360 : 0;
    yo[i] = y[i] + bias;
  }
  return yo;
}

// function std(v) {
//   mu = mean(v);
//   sum = 0;
//   for (var i = 0; i < v.length; i++) {
//     sum += Math.pow(Math.abs(v[i] - mu), 2);
//   }
//   return Math.sqrt(sum / (v.length - 1));
// }

function export2csv() {

  exportToCsv('download.csv', rows);
}

function exportToCsv(filename, rows) {

  var processRow = function (row) {
    var finalVal = '';
    for (var j = 0; j < row.length; j++) {
      var result = processVal(row[j])
      if (j > 0)
        finalVal += ',';
      finalVal += result;
    }
    return finalVal + '\n';
  };

  var csvFile = '';
  // for (var i = 0; i < rows.length; i++) {
  //     csvFile += processRow(rows[i]););
  // }
  let fields = Object.keys(rows);

  csvFile += processRow(Object.keys(rows));
  //Object.keys(rows).forEach(field => csvFile += processRow(rows[field]));
  for (var j = 0; j < rows[fields[0]].length; j++) {
    csvFile += column2row(rows, j);
  }


  var blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
  if (navigator.msSaveBlob) { // IE 10+
    navigator.msSaveBlob(blob, filename);
  } else {
    var link = document.createElement("a");
    if (link.download !== undefined) { // feature detection
      // Browsers that support HTML5 download attribute
      var url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  function column2row(row, j) {
    let finalVal = '';
    Object.keys(rows).forEach(field => finalVal += processVal(row[field][j]) + ',');
    finalVal = finalVal.slice(0, -1);
    return finalVal + '\n';
  }

  function processVal(val) {
    var innerValue = val === null ? '' : val.toString();
    if (val instanceof Date) {
      innerValue = val.toLocaleString();
    };
    var result = innerValue.replace(/"/g, '""');
    if (result.search(/("|,|\n)/g) >= 0)
      result = '"' + result + '"';
    return result;
  }
}

function getIdx(arr, val) {
  var indexes = [], i = -1;
  while ((i = arr.indexOf(val, i + 1)) != -1) {
    indexes.push(i);
  }
  return indexes;
}

function addLabelsLine() {

  if (document.getElementById("labelsNavBar").style.display == "none") {
    document.getElementById('labelsNavBar').style.display = 'flex';

    var SignalLabels = localStorage["SignalLabels"];
    if (SignalLabels != undefined) {
      document.getElementById("labelsInput").value = SignalLabels;
    }
    document.getElementById("labelsInput").addEventListener('input', updateValue);
  } else {
    document.getElementById('labelsNavBar').style.display = 'none';
  }

  function updateValue(e) {
    localStorage.setItem('SignalLabels', document.getElementById("labelsInput").value);
  }

  /*if ( !document.getElementById('labelsInput') ) {
 
  var label = document.createElement("label");
  label.innerHTML = "Labels: "
  label.htmlFor = "labels";
  var input = document.createElement('input');
  input.name = 'labelsInput';
  input.id = 'labelsInput';
  document.getElementById('labelsNavBar').appendChild(label);
  document.getElementById('labelsNavBar').appendChild(input);
  }
  else {
    document.getElementById('labelsInput').style.display = 'none';
 
  }*/
}

let mult = (array, factor) => array.map(x => x * factor);

const multArrays = (arr1, arr2) => arr1.map((num, i) => num * arr2[i]);

let plus = (array, plus) => array.map(x => parseFloat(x) + plus);

const minusArrays = (a, b) => a.map((val, index) => val - b[index]);

let removeFirst = (array) => array.map((item, idx, all) => parseFloat(item) - parseFloat(all[0]));

let removeMean = (array) => array.map((item, idx, all) => parseFloat(item) - mean(all));

let mean = (array) => array.reduce((a, b) => parseFloat(a) + parseFloat(b)) / array.length;

const derivative = arr => arr.slice(1).map((val, index) => 333 * (val - arr[index]));

const std = arr => Math.sqrt(arr.map(x => Math.pow(x - mean(arr), 2)).reduce((a, b) => a + b) / (arr.length-1));

const minPositive = arr => {
  const positives = arr.filter(num => num > 0);
  return positives.length > 0 ? Math.min(...positives) : Math.max(...arr);
};

let maxAbs = (arr) => Math.max(...arr.map(Math.abs));
const maxNegative = arr => {
  const negatives = arr.filter(num => num < 0);
  return negatives.length > 0 ? Math.max(...negatives) : Math.min(...arr);
};

let min = (arr) => r2d * Math.min(...arr);
let max = (arr) => r2d * Math.max(...arr);

//const minPositive = arr => Math.min(...arr.filter(num => num > 0));   // the minimum of only the positive numbers (closest to zero)
//const maxNegative = arr => Math.max(...arr.filter(num => num < 0));   // the maximum of only the negtive numbers (closest to zero)

let strClean = (str) => str.replace(/[^a-zA-Z0-9 ]/g, "");

let lastVal = (arr) => (parseFloat(arr.slice(-1)[0]) * r2d);

const findFirstChangeIndex = data => data.findIndex((value, index) => index > 0 && value !== data[index - 1]);


let r2d = 180 / 3.1416;
let d2r = 3.1416 / 180;

//var minIdx = (array, val) => array.findIndex(n => n > val);
//var maxIdx = (array, val) => array.findIndex(n => n > val);

////////////////////////// End of Math Operations ///////////////////////////
