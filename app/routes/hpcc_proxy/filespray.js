const express = require('express');
const router = express.Router();

const dns = require('dns');

const ipv4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}';
const ipRegex = new RegExp(`(?:^${ipv4}$)`);

const multer = require('multer');
const _destPath = process.env.LANDING_ZONE;
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

const filesprayCtrl = require('../../controllers/filespray');

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
], filesprayCtrl.uploadFile);

router.post('/spray', [
  upload.none(),
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  console.log('in /spray ', req.body, req.params, router.clusters);

  filesprayCtrl.sprayFile(
    req.clusterAddrAndPort,
    req.body.filename,
    req.session.user.username,
    req.body.workspaceName,
    req.body.dropzone
  ).then((response) => {
    console.log(response.body);
    let json = JSON.parse(response.body);
    res.json({ wuid: json.SprayResponse.wuid });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

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

router.post('/dfuQuery', [
  upload.none(),
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddrAndPort + '/WsDfu/DFUQuery.json',
    form: {
      LogicalName: '*' + req.body.query + '*',
      PageSize: 25,
      Sortby: 'Modified',
      Descending: 1,
      PageStartFrom: 1,
      rawxml_: 1
    },
    resolveWithFullResponse: true
  }).then((response) => {
    console.log(response);
    let json = JSON.parse(response.body),
        data = [];

    if (json.DFUQueryResponse.NumFiles > 0) {
      json.DFUQueryResponse.DFULogicalFiles.DFULogicalFile.forEach((file) => {
        data.push(file.Name);
      });
    }
    res.json(data);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.post('/dfuInfo', [
  upload.none(),
  body('workspaceId').isUUID(4).withMessage('Invalid workspace id'),
  buildClusterAddr,
], (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddrAndPort + '/WsDfu/DFUInfo.json',
    form: {
      Name: req.body.name,
    },
    resolveWithFullResponse: true
  }).then((response) => {
    console.log(response);
    let json = JSON.parse(response.body),
        data = {},
        fileName = '';

    if (json.DFUInfoResponse) {
      data.wuid = json.DFUInfoResponse.FileDetail.Wuid;
      data.query = json.DFUInfoResponse.FileDetail.Ecl;

      let origName = json.DFUInfoResponse.FileDetail.Filename;
      if (origName.lastIndexOf('.') > -1) {
        origName.substr(0, origName.lastIndexOf('.')).split(/[-_]/)
          .forEach((part) => fileName += part.charAt(0).toUpperCase() + part.substr(1));
      } else {
        fileName = origName;
      }

      data.name = fileName;
      data.rows = json.DFUInfoResponse.FileDetail.RecordCountInt64;
    }
    res.json(data);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

module.exports = router;