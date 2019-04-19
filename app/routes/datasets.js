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
    FROM Datasets AS d \
    LEFT JOIN Workunits AS w ON d.id = w.objectId \
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
  let dataset = {};
  if (req.body.name) dataset.name = req.body.name;
  if (req.body.filename) dataset.filename = req.body.filename;
  if (req.body.logicalfile) dataset.logicalfile = req.body.logicalfile;
  if (req.body.workspaceId) dataset.workspaceId = req.body.workspaceId;
  if (req.body.rowCount) dataset.rowCount = req.body.rowCount;
  if (req.body.columnCount) dataset.columnCount = req.body.columnCount;
  if (req.body.eclSchema) dataset.eclSchema = JSON.parse(req.body.eclSchema);
  if (req.body.eclQuery) dataset.eclQuery = req.body.eclQuery;
  if (Object.keys(dataset).length > 0) {
    Dataset.update(dataset, {
      where: {
        id: req.body.id
      }
    }).then((_dataset) => {
      return res.json({ success: true, data: dataset });
    }).catch((err) => {
      console.log(err);
      return res.json({ success: false, message: 'The Dataset could not be saved' });
    });
  }
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
    return res.json({ success: true, message: 'Dataset deleted' });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Dataset could not be deleted' });
  });
});

module.exports = router;