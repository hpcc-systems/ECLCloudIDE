'use strict';

let numRowsToScan = 15;

let parseDatasetFile = async (file, Papa) => {
  let fileExtension = file.name.substr(file.name.lastIndexOf('.') + 1);
  switch(fileExtension) {
    case 'csv':
    default:
      return parseCsv(file, Papa);
      break;
  } //end switch
};

let parseCsv = async (file, Papa) => {
  return new Promise((resolve, reject) => {
    let averages = {}, labels = [], values = [];

    Papa.parse(file, {
      header: true,
      preview: numRowsToScan,

      error: (err, file) => {
        return reject({
          success: false,
          errorMsg: err,
          schema: null,
          data: null
        });
      },

      complete: (results, file) => {
        let labels = Object.keys(results.data[0]),
            values = Object.values(results.data[0]);

        // console.log(results);

        if (labels.length != values.length) {
          return reject({
            success: false,
            errorMsg: 'CSV could not be parsed. The number of column headings was different than ' +
              'the number of items in the first row of data.',
            schema: null,
            data: null
          });
        }

        let averages = {};

        for (var i = 1; i < numRowsToScan; i++) {
          let values = Object.values(results.data[i]);
          values.forEach((val, idx) => {
            if (!averages[labels[idx]]) averages[labels[idx]] = 0;
            averages[labels[idx]] += val.length;
          });
        }

        for (var i = 0; i < Object.keys(averages).length; i++) {
          averages[labels[i]] = averages[labels[i]] / 10;
          if (averages[labels[i]] > 10) {
            averages[labels[i]] = Math.floor((Math.log(averages[labels[i]]) / 1.5) * averages[labels[i]]);
          } else {
            averages[labels[i]] = Math.round((1 + Math.log(averages[labels[i]])) * averages[labels[i]]);
          }
        }

        return resolve({
          success: true,
          errorMsg: '',
          schema: averages,
          data: values
        });

      } //end Papa.parse complete callback
    }); //end Papa.parse defn

  }); //end return new Promise(...)
}; //end parseCsv

export { parseDatasetFile };