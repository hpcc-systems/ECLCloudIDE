const express = require('express');
const router = express.Router();

const dns = require('dns');

const ipv4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}';
const ipRegex = new RegExp(`(?:^${ipv4}$)`);

const multer = require('multer');
const _destPath = './landing_zone';
const _storage = multer.diskStorage({
  destination: function(req, file, callback) {
    callback(null, _destPath);
  },
  filename: function(req, file, callback) {
    callback(null, Date.now() + '_' + file.originalname);
  }
});
const upload = multer({ storage: _storage });

const fs = require('fs');

let request = require('request-promise');

let buildClusterAddr = (req, res, next) => {
  console.log('in buildClusterAddr middleware ', req.body, req.params, req.file);
  if (req.body.clusterAddr) {
    router.clusterAddr = req.body.clusterAddr;
    console.log('router.clusterAddr: ' + router.clusterAddr, 'first 4: ' + router.clusterAddr.substring(0, 4));
    if (router.clusterAddr.substring(0, 4) != 'http') {
      router.clusterAddrAndPort = 'http://' + router.clusterAddr;
    } else {
      router.clusterAddrAndPort = router.clusterAddr;
    }
    if (req.body.clusterPort) {
      router.clusterPort = req.body.clusterPort;
      router.clusterAddrAndPort += ':' + router.clusterPort;
    }

    let dropZoneJson = request({
      uri: router.clusterAddrAndPort + '/WsTopology/TpDropZoneQuery.json',
      json: true
    });
    let clusterJson = request({
      uri: router.clusterAddrAndPort + '/WsTopology/TpTargetClusterQuery.json',
      json: true
    });

    Promise.all([
      dropZoneJson.catch((err) => { console.log(err); }),
      clusterJson.catch((err) => { console.log(err); })
    ])
    .then((values) => {
      if (values[1] instanceof Error !== true) {
        router.clusters = values[1].TpTargetClusterQueryResponse.TpTargetClusters.TpTargetCluster
          .filter((cluster) => cluster.Type === 'ThorCluster')[0].TpClusters.TpCluster
          .map((cluster) => cluster.Name);
      } else {
        router.clusters = [];
      }

      let dropzone = values[0].TpDropZoneQueryResponse.TpDropZones.TpDropZone[0];

      router.dropzoneIp = dropzone.TpMachines.TpMachine[0].Netaddress;

      if (ipRegex.test(router.clusterAddr)) {
        console.log('clusterAddr is an IP');
        router.clusterIp = router.clusterAddr;
        next();
      } else {
        dns.lookup(router.clusterAddr, {}, (err, address, family) => {
          console.log('dns lookup for ' + router.clusterAddr + ': ' + address);
          router.clusterIp = address;
          next();
        });
      }
    });
  }
}

router.post('/upload', [upload.single('file'), buildClusterAddr], (req, res, next) => {
  console.log('in /upload ', req.body, req.params, req.file);

  let _filename = req.file.filename,
      _mimetype = req.file.mimetype,
      _fileStream = fs.createReadStream(_destPath + '/' + _filename),
      _clusterFilename = _filename.substr(_filename.indexOf('_') + 1);

  request({
    method: 'POST',
    uri: router.clusterAddrAndPort + '/Filespray/UploadFile.json?upload_' +
      '&NetAddress=' + router.dropzoneIp + '&rawxml_=1&OS=2&' +
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
    fs.unlinkSync(_destPath + '/' + _filename);
    res.json({ file: _clusterFilename });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.post('/spray', [upload.none(), buildClusterAddr], (req, res, next) => {
  console.log('in /spray ', req.body, req.params, req.file);

  router.sprayFile(router.clusterAddrAndPort, req.body.filename, req.session.user.username, req.body.workspaceId)
    .then((response) => {
      console.log(response.body);
      let json = JSON.parse(response.body);
      res.json({ wuid: json.SprayResponse.wuid });
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });
});

router.sprayFile = (clusterAddr, filename, username, workspaceId, dropzoneIp = '') => {
  if (dropzoneIp == '' && router && router.dropzoneIp) {
    dropzoneIp = router.dropzoneIp;
  }
  return request({
    method: 'POST',
    uri: clusterAddr + '/FileSpray/SprayVariable.json',
    formData: {
      destGroup: 'mythor',
      DFUServerQueue: 'dfuserver_queue',
      namePrefix: username + '::' + workspaceId,
      targetName: filename,
      sourceFormat: 1,
      sourceCsvSeparate: '\,',
      sourceCsvTerminate: '\n,\r\n',
      sourceCsvQuote: '"',
      overwrite: 'on',
      sourceIP: dropzoneIp,
      sourcePath: '/var/lib/HPCCSystems/mydropzone/' + filename,
      destLogicalName: username + '::' + workspaceId + '::' + filename,
      rawxml_: 1
    },
    resolveWithFullResponse: true
  });
};

router.post('/getDfuWorkunit', [upload.none(), buildClusterAddr], (req, res, next) => {
  request({
    method: 'POST',
    uri: router.clusterAddrAndPort + '/FileSpray/GetDFUWorkunit.json',
    formData: {
      wuid: req.body.wuid,
      rawxml_: 1
    },
    resolveWithFullResponse: true
  }).then((response) => {
    let json = JSON.parse(response.body),
        result = json.GetDFUWorkunitResponse.result;
    res.json({
      wuid: result.ID,
      complete: (result.PercentDone < 100) ? 0 : 1,
    });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.post('/DfuQuery', (req, res, next) => {
  request({
    method: 'POST',
    uri: router.clusterAddrAndPort + '/WsDfu/DFUQuery.json',
    formData: {
      wuid: '',
      rawxml_: 1
    },
    resolveWithFullResponse: true
  }).then((response) => {
    let json = JSON.parse(response.body),
        result = json.GetDFUWorkunitResponse.result;
    res.json({
      wuid: result.ID,
      complete: (result.PercentDone < 100) ? 0 : 1,
    });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

module.exports = router;