const express = require('express');
const router = express.Router();

const dns = require('dns');

const ipv4 = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}';
const ipRegex = new RegExp(`(?:^${ipv4}$)`);

const { query, body, validationResult } = require('express-validator');

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

router.post('/explore', [
  buildClusterAddr,
], (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddrAndPort + '/WsDfu/DFUFileView.json',
    form: req.body.DFUFileViewRequest,
    resolveWithFullResponse: true
  }).then((response) => {
    let json = JSON.parse(response.body);
    return res.json(json);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

module.exports = router;