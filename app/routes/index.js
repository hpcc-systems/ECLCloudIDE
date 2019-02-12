const express = require('express');
const router = express.Router();

const request = require('request-promise');

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render('index', { title: 'ECL IDE' });
});

module.exports = router;
