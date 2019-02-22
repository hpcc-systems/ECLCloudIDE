const express = require('express');
const router = express.Router();

let request = require('request-promise');

let buildClusterAddr = (req, res, next) => {
  if (req.body.clusterAddr && req.body.clusterPort) {
    req.clusterAddr = req.body.clusterAddr + ':' + req.body.clusterPort;
    next();
  }
}

router.post('/', buildClusterAddr, (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddr + '/WsWorkunits/WUCreate.json',
    form: { rawxml_: true },
    resolveWithFullResponse: true
  }).then((response) => {
    let json = JSON.parse(response.body);
    res.json({ wuid: json.WUCreateResponse.Workunit.Wuid });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

router.put('/', buildClusterAddr, (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddr + '/WsWorkunits/WUUpdate.json',
    form: { wuid: req.body.wuid, query: req.body.query },
    resolveWithFullResponse: true
  }).then((response) => {
    let json = JSON.parse(response.body);
    res.json({ wuid: json.WUCreateResponse.Workunit.Wuid });
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

module.exports = router;