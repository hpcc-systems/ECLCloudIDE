var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/account', function(req, res, next) {
  res.render('users/account', { title: 'ECL IDE' });
});

module.exports = router;
