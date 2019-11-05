const express = require('express');
const router = express.Router();

const request = require('request-promise');

/* GET home page. */
router.get('/', (req, res, next) => {
  let user = {
    id: req.session.user.id,
    username: req.session.user.username,
    emailVerified: req.session.user.emailVerified
  };
  res.render('index', { title: 'ECL IDE', user: user, csrfToken: req.csrfToken() });
});

module.exports = router;
