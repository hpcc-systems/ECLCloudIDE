const express = require('express');
const router = express.Router();

const db = require('../models/index');

const User = db.User;
const Workspace = db.Workspace;
const WorkspaceUser = db.WorkspaceUser;

const Dataset = db.Dataset;
const Script = db.Script;
const Workunit = db.Workunit;

router.get('/', (req, res, next) => {
  console.log('request query', req.query);
  const query = `SELECT d.*, w.workunitId \
    FROM datasets AS d \
    LEFT JOIN workunits AS w ON d.id = w.objectId \
    WHERE d.workspaceId = "${req.query.workspaceId}" \
    AND w.workunitId LIKE "W%" \
    AND d.deletedAt IS NULL`;

  db.sequelize.query(query, {
    type: db.sequelize.QueryTypes.SELECT
  }).then((datasets) => {
    res.json(datasets);
  }).catch((err) => {
    console.log(err);
    res.json(err);
  });
});

/* Create dataset */
router.post('/', (req, res, next) => {
  console.log('request body', req.body);
  Dataset.findAll({
    where: {
      workspaceId: req.body.workspaceId,
      filename: req.body.filename,
      deletedAt: null
    }
  }).then((datasets) => {
    let _message = 'Dataset could not be saved';

    if (datasets.length > 0) {
      _message = "A Dataset for the file \"" + req.body.filename + "\" has already been added to this workspace.\n";
      return res.json({ success: false, message: _message });
    } else {
      Dataset.create({
        name: req.body.name,
        filename: req.body.filename,
        workspaceId: req.body.workspaceId
      }).then((dataset) => {
        return res.json({ success: true, data: dataset });
      }).catch((err) => {

        if (err.errors) {
          _message = '';

          err.errors.forEach((_err) => {
            console.log(_err);
            switch (_err.type) {
              case 'unique violation':
                let _filename = _err.instance.dataValues.filename;
                _message += "A Dataset for the file \"" + _filename + "\" has already been added to this workspace.\n"
                break;
              default:
                _message += _err.message;
                break;
            }
          });
        }

        return res.json({ success: false, message: _message });
      });
    }
  });
});

/* Update dataset */
router.put('/', (req, res, next) => {
  Dataset.update({
    name: req.body.name,
    filename: req.body.filename,
    logicalfile: req.body.logicalfile,
    workspaceId: req.body.workspaceId,
  }, {
    where: {
      id: req.body.id
    }
  });
});

/* Create dataset */
router.delete('/', (req, res, next) => {
  console.log('request body', req.body);
  Dataset.findOne({
    where: {
      id: req.body.datasetId,
    }
  }).then((dataset) => {
    Dataset.destroy({
      where: { id: dataset.id }
    });
    Workunit.destroy({
      where: { objectId: dataset.id }
    });
  }).then(() => {
    res.json({ success: true, message: 'Dataset deleted' });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Dataset could not be saved' });
  });
});

module.exports = router;