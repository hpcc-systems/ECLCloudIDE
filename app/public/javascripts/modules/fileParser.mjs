'use strict';

let numRowsToScan = 15;

let parseDatasetFile = async (file, Papa, rowPath) => {
  let fileExtension = file.name.substr(file.name.lastIndexOf('.') + 1);
  switch(fileExtension) {
    case 'json':
      let content = await file.text(),
          json = JSON.parse(content);
      return parseJson(json, rowPath);
      break;
    case 'csv':
    default:
      return parseCsv(file, Papa);
      break;
  } //end switch
};

let parseJson = (json, rowPath) => {
  let averages = {}, labels = [], values = [], rowLimit = numRowsToScan, _json = json;

  try {
    if (rowPath.length == 1 && rowPath[0] == '') {
      labels = Object.keys(json[0]);
      values = Object.values(json[0]);
    } else {
      rowPath.forEach((prop) => {
        _json = _json[prop]
      });
      rowLimit = (numRowsToScan < _json.length) ? numRowsToScan : _json.length;
      labels = Object.keys(_json[0]);
      values = Object.values(_json[0]);
    }
  } catch(e) {
    return {
      success: false,
      errorMsg: 'Cannot parse JSON using specified Row Path',
      schema: null,
      data: null
    }
  }

  for (var i = 1; i < rowLimit; i++) {
    let parseValue = (_label, val, isDataset = false) => {
      let alphaNumLabel = _label.trim().replace(/[^_a-zA-Z0-9]+/g, '');
      if (!averages[alphaNumLabel]) averages[alphaNumLabel] = { _type: '', _length: 0, _path: '' };
      if (Array.isArray(val)) {
        averages[alphaNumLabel]._type = 'set of ';
        val.forEach((obj, _idx) => {
          if (obj && typeof obj === 'object') {
            parseValue(_label, obj, true);
          } else {
            let str = obj.toString(),
                length = str.length;
            if (_idx == 0) {
              switch (typeof obj) {
                case 'number':
                  str = Math.abs(obj).toString();
                  if (Number.isInteger(obj)) {
                    averages[alphaNumLabel]._type += 'integer';
                    if (length > averages[alphaNumLabel]._length) {
                      averages[alphaNumLabel]._length = length;
                    }
                  } else {
                    averages[alphaNumLabel]._type += 'decimal';
                    length = str.replace('.', '').length;
                    if (length > parseInt(averages[alphaNumLabel]._length.toString().split('_')[0], 10)) {
                      let decLength = str.substr(str.indexOf('.') + 1).length;
                      averages[alphaNumLabel]._length = length + '_' + decLength;
                    }
                  }
                  break;
                case 'boolean':
                  averages[alphaNumLabel]._type = 'boolean';
                  averages[alphaNumLabel]._length = -1;
                  break;
                default:
                  averages[alphaNumLabel]._type += 'string';
                  if (length > averages[alphaNumLabel]._length) {
                    averages[alphaNumLabel]._length = length;
                  }
                  break;
              } //end switch
              averages[alphaNumLabel]._path = '{xpath(\'' + _label + '\')}';
            } //end if (_idx == 0)
          }
        })
      } else if (val && typeof val === 'object') {
        averages[alphaNumLabel] = { isDataset: isDataset };
        for (var x in val) {
          let alphaNumKey = x.trim().replace(/[^a-zA-Z0-9]+/g, '');
          if (!averages[alphaNumLabel][alphaNumKey]) averages[alphaNumLabel][alphaNumKey] = { _type: '', _length: 0, _path: '' };
          if (Array.isArray(val[x])) {
            averages[alphaNumLabel][alphaNumKey]._type = 'set of ';
            val[x].forEach((y, _idx) => {
              let str = y.toString(),
                  length = str.length;
              if (_idx == 0) {
                switch (typeof y) {
                  case 'number':
                    str = Math.abs(y).toString();
                    if (Number.isInteger(y)) {
                      averages[alphaNumLabel][alphaNumKey]._type += 'integer';
                      if (length > averages[alphaNumLabel][alphaNumKey]._length) {
                        averages[alphaNumLabel][alphaNumKey]._length = length;
                      }
                    } else {
                      averages[alphaNumLabel][alphaNumKey]._type += 'decimal';
                      length = str.replace('.', '').length;
                      if (length > parseInt(averages[alphaNumLabel][alphaNumKey]._length.toString().split('_')[0], 10)) {
                        let decLength = str.substr(str.indexOf('.') + 1).length;
                        averages[alphaNumLabel][alphaNumKey]._length = length + '_' + decLength;
                      }
                    }
                    break;
                  case 'boolean':
                    averages[alphaNumLabel][alphaNumKey]._type = 'boolean';
                    averages[alphaNumLabel][alphaNumKey]._length = -1;
                    break;
                  default:
                    averages[alphaNumLabel][alphaNumKey]._type += 'string';
                    if (length > averages[alphaNumLabel][alphaNumKey]._length) {
                      averages[alphaNumLabel][alphaNumKey]._length = length;
                    }
                    break;
                } //end switch
                averages[alphaNumLabel][alphaNumKey]._path = '{xpath(\'' + x + '\')}';
              } //end if (_idx == 0)
            });
          } else if (val[x] && typeof val[x] === 'object') {
            parseValue(_label, val[x], true);
          } else {
            if (val && val[x] != undefined) {
              let str = val[x].toString(),
                  length = str.length;
              switch (typeof val[x]) {
                case 'number':
                  str = Math.abs(val[x]).toString();
                  if (Number.isInteger(val[x])) {
                    averages[alphaNumLabel][alphaNumKey]._type = 'integer';
                    if (length > averages[alphaNumLabel][alphaNumKey]._length) {
                      averages[alphaNumLabel][alphaNumKey]._length = length;
                    }
                  } else {
                    averages[alphaNumLabel][alphaNumKey]._type = 'decimal';
                    length = str.replace('.', '').length;
                    if (length > parseInt(averages[alphaNumLabel][alphaNumKey]._length.toString().split('_')[0], 10)) {
                      let decLength = str.substr(str.indexOf('.') + 1).length;
                      averages[alphaNumLabel][alphaNumKey]._length = length + '_' + decLength;
                    }
                  }
                  break;
                case 'boolean':
                  averages[alphaNumLabel][alphaNumKey]._type = 'boolean';
                  averages[alphaNumLabel][alphaNumKey]._length = -1;
                  break;
                default:
                  averages[alphaNumLabel][alphaNumKey]._type = 'string';
                  if (length > averages[alphaNumLabel][alphaNumKey]._length) {
                    averages[alphaNumLabel][alphaNumKey]._length = length;
                  }
                  break;
              } //end switch
              averages[alphaNumLabel][alphaNumKey]._path = '{xpath(\'' + x + '\')}';
            }
          }
        }
      } else {
        if (!averages[alphaNumLabel]) averages[alphaNumLabel] = { _type: '', _length: 0, _path: '' };
        if (val != null && val != undefined) {
          let str = val.toString(),
              length = str.length;
          switch (typeof val) {
            case 'number':
              if (Number.isInteger(val)) {
                averages[alphaNumLabel]._type = 'integer';
                if (val.toString().length > averages[alphaNumLabel]._length) {
                  averages[alphaNumLabel]._length = length;
                }
              } else {
                averages[alphaNumLabel]._type = 'decimal';
                length = str.replace('.', '').length;
                if (length > parseInt(averages[alphaNumLabel]._length.toString().split('_')[0], 10)) {
                  let decLength = str.substr(str.indexOf('.') + 1).length;
                  averages[alphaNumLabel]._length = length + '_' + decLength;
                }
              }
              break;
            case 'boolean':
              averages[alphaNumLabel]._type = 'boolean';
              averages[alphaNumLabel]._length = -1;
              break;
            default:
              averages[alphaNumLabel]._type = 'string';
              if (length > averages[alphaNumLabel]._length) {
                averages[alphaNumLabel]._length = length;
              }
              break;
          } //end switch
          averages[alphaNumLabel]._path = '{xpath(\'' + _label + '\')}';
        } //end else val is neither array nor object
      }
    }; //end parseValue()

    for (var key in _json[i]) {
      parseValue(key, _json[i][key]);
    }
  }
  return {
    success: true,
    errorMsg: '',
    schema: averages,
    data: values
  };
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

        if (results.errors.length > 0 || labels.length != values.length) {
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
            let _label = labels[idx].trim().replace(new RegExp('[^a-zA-Z0-9]', 'g'), '');
            if (!averages[_label]) averages[_label] = { _type: typeof val, _length: 0, _path: '' };
            if (val && val.toString().length > averages[_label]._length) {
              averages[_label]._length = val.toString().length;
            }
          });
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