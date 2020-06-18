const express = require('express');
const router = express.Router();

const request = require('request-promise');

const clusterWhitelist = require('../cluster-whitelist')[process.env.NODE_ENV];

/* GET home page. */
router.get('/', (req, res, next) => {
  res.locals.errors = req.flash('error');
  res.locals.info = req.flash('info');
  let user = {
    id: req.session.user.id,
    username: req.session.user.username,
    emailVerified: req.session.user.emailVerified
  };

  let datasetFormats = [];
  if (process.env.DATASETS_CSV == 1) { datasetFormats.push('.csv'); }
  if (process.env.DATASETS_JSON == 1) { datasetFormats.push('.json'); }
  if (process.env.DATASETS_FLAT == 1) { datasetFormats.push('.txt'); }

  res.render('index', {
    title: 'ECL IDE',
    user: user,
    allowedDatasetFormats: datasetFormats.join(', '),
    csrfToken: req.csrfToken(),
    clusterList: clusterWhitelist
  });
});

module.exports = router;