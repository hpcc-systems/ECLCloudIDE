const express = require('express');
const router = express.Router();

let request = require('request-promise');

router.post('/upload', (req, res, next) => {
  request({
    method: 'POST',
    uri: req.clusterAddr + '/Filespray/UploadFile.json',
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