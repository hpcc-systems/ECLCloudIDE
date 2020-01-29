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

const { query, body, validationResult } = require('express-validator/check');

let request = require('request-promise');
let crypt = require('../../utils/crypt');

const db = require('../../models/index');
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

let buildClusterAddr = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  let workspaceId = req.body.workspaceId || req.query.workspaceId;
  Workspace.findOne({
    where: { id: workspaceId },
    through: {
      where: { role: WorkspaceUser.roles.OWNER }
    }
  }).then(workspace => {
    let cluster = workspace.cluster;
    if (cluster.indexOf(':') == 4) {
      let addr = cluster.substr(7).split(':');
      req.clusterAddr = addr[0];
      req.clusterPort = addr[1];
    } else if (cluster.lastIndexOf(':') > -1) {
      let addr = cluster.split(':');
      req.clusterAddr = addr[0];
      req.clusterPort = addr[1];
    }
    req.clusterAddrAndPort = cluster;
    if (req.clusterAddrAndPort.substring(0, 4) != 'http') {
      req.clusterAddrAndPort = 'http://' + req.clusterAddrAndPort;
    }
    if (workspace.clusterUser && workspace.clusterPwd) {
      let creds = workspace.clusterUser + ':' + crypt.decrypt(workspace.clusterPwd);
      let auth = Buffer.from(creds).toString('base64');
      req.headers.Authorization = 'Basic ' + auth;
    }
    if (ipRegex.test(req.clusterAddr)) {
      req.clusterIp = req.clusterAddr;
      next();
    } else {
      dns.lookup(req.clusterAddr, {}, (err, address, family) => {
        req.clusterIp = address;
        next();
      });
    }
  });
}

router.post('/upload', [
  upload.single('file'),
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  console.log('in /upload ', req.body, req.params, req.file);

  let _filename = req.file.filename,
      _mimetype = req.file.mimetype,
      _fileStream = fs.createReadStream(_destPath + '/' + _filename),
      _clusterFilename = _filename.substr(_filename.indexOf('_') + 1);

  request({
    method: 'POST',
    uri: req.clusterAddrAndPort + '/Filespray/UploadFile.json?upload_' +
      '&NetAddress=' + req.clusterIp + '&rawxml_=1&OS=2&' +
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

router.post('/spray', [
  upload.none(),
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  console.log('in /spray ', req.body, req.params, req.file, router.clusters);

  router.sprayFile(req.clusterAddrAndPort, req.body.filename, req.session.user.username, req.body.workspaceName, req.clusterIp)
    .then((response) => {
      console.log(response.body);
      let json = JSON.parse(response.body);
      res.json({ wuid: json.SprayResponse.wuid });
    }).catch((err) => {
      console.log(err);
      res.json(err);
    });
});

router.sprayFile = (clusterAddr, filename, username, workspaceName, dropzoneIp = '') => {
  if (dropzoneIp == '' && router && router.dropzoneIp) {
    dropzoneIp = router.dropzoneIp;
  }
  return request({
    method: 'POST',
    uri: clusterAddr + '/FileSpray/SprayVariable.json',
    formData: {
      destGroup: (router.clusters && router.clusters.length > 0) ?
        router.clusters[Math.floor(Math.random() * Math.floor(router.clusters.length))] :
        'mythor',
      DFUServerQueue: 'dfuserver_queue',
      namePrefix: username + '::' + workspaceName,
      targetName: filename,
      sourceFormat: 1,
      sourceCsvSeparate: '\,',
      sourceCsvTerminate: '\n,\r\n',
      sourceCsvQuote: '"',
      overwrite: 'on',
      sourceIP: dropzoneIp,
      sourcePath: '/var/lib/HPCCSystems/mydropzone/' + filename,
      destLogicalName: username + '::' + workspaceName + '::' + filename,
      rawxml_: 1
    },
    resolveWithFullResponse: true
  });
};

router.post('/getDfuWorkunit', [
  upload.none(),
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
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

router.post('/DfuQuery', [
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
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