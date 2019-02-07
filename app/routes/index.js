const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  if (!req.session.user) {
    res.redirect('/auth/login');
  } else {
    res.render('index', { title: 'ECL IDE' });
  }
});

module.exports = router;
