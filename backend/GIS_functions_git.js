//GIS_functions.js created by Pirjot Atwal
//Created for GIS management, stores utility functions to help
//correct errors existing in the NSTEM GIS map for interns
//and accredited colleges and universities across the nation.
//Requires the Leaflet Esri Library as a dependency

/**
 * Uses Leaflet Esri Geocoding library to make an API call to 
 * ARCGis for coordinates of a given address. Returns coords on
 * receival.
 * @param {String} address 
 * @return {JSON} Returns Esri response object
 */
async function lookup(address = 'Gloucester, Massachusetts USA') {
    var req = L.esri.Geocoding.geocode().text(address).run(function (err, results, response) {});
    var loaded = false,
        result = null;
    req.addEventListener("load", function (evt) {
        loaded = true;
        result = JSON.parse(evt.currentTarget.response);
    });
    const delay = (ms = 500) => new Promise(res => setTimeout(res, ms));
    while (!loaded) {
        await delay(100);
    }
    return result;
}

/**
 * Tests a batch of rows resembling the layout of the GIS spreadsheet.
 * @param {Array} arr All arrays to be tested. Must be length >= 8
 * @param {"float"} threshold Threshold for which badrows are considered.
 * @return {JSON} Returns JS object with arrays of all rows tested.
 */
async function checkMapRows(arr, threshold = 1) {
    var badRows = [],
        goodRows = [],
        unEval = [];
    if (!arr || arr.length == 0) {
        return null;
    }
    for (var row of arr) {
        if (row && row.length > 8 && row[1] && row[6] && row[7]) {
            var input = [parseFloat(row[6]), parseFloat(row[7])];
            var find = (await lookup(row[1])).candidates[0].location;
            var real = [find.y, find.x];
            var difference = [Math.abs(real[0] - input[0]), Math.abs(real[1] - input[1])];
            if (difference[0] > threshold || difference[1] > threshold) {
                badRows.push(row.concat([real[0], real[1]]));
            } else {
                goodRows.push(row.concat([real[0], real[1]]));
            }
        } else {
            unEval.push(row);
        }
    }
    return {
        'badRows': badRows,
        'goodRows': goodRows,
        'unEval': unEval
    };
}

/**
 * Uses established GAPI classes to test for rows in the GIS spreadsheet
 * available here:
 * "REDACTED URL"
 * where for any row where the Latitude or Longitude are a threshold distance
 * away from their correct coordinates, they will be recorded as such.
 * @param {Function} printFunc The Function through which GISPerform should give updates.
 * @param {"float"} threshold Threshold for which badrows are considered.
 * @param {Integer} rowAmount Amount of Rows at the start of the spreadsheet to consider. By Default Considers All
 * @param {JSON} rows With all corresponding rows recordeds
 */
async function GISCheck(printFunc = console.log, threshold = 1, rowAmount = null) {
    printFunc("GIS Check Called! Check the Network tab in your Developer Tools for updates!");
    if (manager) {
        //Import Leaflet Libraries
        var dependencies = ["https://unpkg.com/leaflet@1.7.1/dist/leaflet.js",
            "https://unpkg.com/esri-leaflet@2.5.3/dist/esri-leaflet.js",
            "https://unpkg.com/esri-leaflet-geocoder@2.3.3/dist/esri-leaflet-geocoder.js"
        ];
        for (var dep of dependencies) {
            var script = document.createElement("script");
            script.src = dep;
            script.async = false;
            document.body.appendChild(script);
        }
        //Initialize Sheet File using dummy info
        var URL = "REDACTED URL";
        var mySheet = new Sheet({
            id: Manager.getID(URL)
        });
        var rows = await mySheet.getRows();
        var answer = await checkMapRows(rows.slice(1, rowAmount + 1 || undefined), threshold);
        printFunc(answer);
        return answer;
    } else {
        printFunc("Manager instance not initialized yet.");
    }
}

//TODO: GISMaintenance Function (Performs GISCheck, then updates rows to fit accordingly, requires authorization before update request is sent).