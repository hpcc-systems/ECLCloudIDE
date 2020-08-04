let request = require('request-promise'),
    fs = require('fs');

const workspacesCtrl = require('./workspaces');

let cluster = {};

exports.setCluster = (_cluster) => {
  cluster = _cluster;
};

exports.uploadFile = async (req, res, next) => {
  console.log('in /upload ', req.body, req.params, req.file);

  let _filename = req.file.filename,
      _mimetype = req.file.mimetype,
      _fileStream = fs.createReadStream(process.env.LANDING_ZONE + '/' + _filename),
      _clusterFilename = _filename.substr(_filename.indexOf('_') + 1),
      dropzoneIp = req.params.dropzone,
      dropzones = await workspacesCtrl.getDropzoneInfo(req.body.workspaceId),
      flatDropzones = [];

  Object.keys(dropzones).forEach(k => {
    flatDropzones = [...flatDropzones, ...dropzones[k]]
  });

  if (flatDropzones.indexOf(req.body.dropzone) == -1) {
    return res.json({ success: false, message: 'The specified dropzone is not listed in the cluster topology.'});
  }

  request({
    method: 'POST',
    uri: req.clusterAddrAndPort + '/Filespray/UploadFile.json?upload_' +
      '&NetAddress=' + req.body.dropzone + '&rawxml_=1&OS=2&' +
      'Path=/var/lib/HPCCSystems/mydropzone/',
    formData: {
      'UploadedFiles[]': {
        value: _fileStream,
        options: {
          filename: _clusterFilename,
          contentType: _mimetype
        }
      },
    },
    resolveWithFullResponse: true
  }).then((response) => {
    console.log(response.body);
    let json = JSON.parse(response.body);
    _fileStream.destroy();
    fs.unlinkSync(process.env.LANDING_ZONE + '/' + _filename);
    res.json({ file: _clusterFilename });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
};

exports.sprayFile = (clusterAddr, filename, username, workspaceName, dropzoneIp = '') => {
  let sprayPayload = {},
      fileExtension = filename.substr(filename.lastIndexOf('.') + 1);

  if (dropzoneIp == '' && router && router.dropzoneIp) {
    dropzoneIp = router.dropzoneIp;
  }

  sprayPayload = {
    destGroup: 'mythor',
    DFUServerQueue: 'dfuserver_queue',
    namePrefix: username + '::' + workspaceName,
    targetName: filename,
    overwrite: 'on',
    sourceIP: dropzoneIp,
    sourcePath: '/var/lib/HPCCSystems/mydropzone/' + filename,
    destLogicalName: username + '::' + workspaceName + '::' + filename,
    rawxml_: 1
  };

  switch (fileExtension) {
    case 'json':
      sprayPayload = { ...sprayPayload, ...{
          sourceFormat: 2,
          sourceMaxRecordSize: '',
          isJSON: 1,
          sourceRowPath: '/',
          targetRowPath: '/'
        }
      };
      break;
    case 'csv':
    default:
      sprayPayload = { ...sprayPayload, ...{
          sourceFormat: 1,
          sourceCsvSeparate: '\,',
          sourceCsvTerminate: '\n,\r\n',
          sourceCsvQuote: '"'
        }
      };
      break;
  } //end switch

  return request({
    method: 'POST',
    uri: clusterAddr + '/FileSpray/SprayVariable.json',
    formData: sprayPayload,
    resolveWithFullResponse: true
  });
};