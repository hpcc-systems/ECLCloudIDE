const express = require('express');
const router = express.Router();

const db = require('../models/index');

const fs = require('fs-extra');

const { body, validationResult } = require('express-validator/check');

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
    WHERE d.workspaceId = :workspaceId \
    AND d.deletedAt IS NULL`;

  db.sequelize.query(query, {
    type: db.sequelize.QueryTypes.SELECT,
    replacements: { workspaceId: req.query.workspaceId }
  }).then((_datasets) => {
    let datasets = {};
    _datasets.forEach((dataset) => {
      datasets[dataset.id] = dataset
    });
    res.json(datasets);
  }).catch((err) => {
    console.log(err);
    res.json({ success: false, message: 'Could not retrieve Datasets for specified Workspace.' });
  });
});

/* Create dataset */
router.post('/', [
  body('workspaceId')
    .isUUID(4).withMessage('Invalid workspace id'),
  body('name')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_]*$/).withMessage('Invalid dataset name'),
  body('filename')
    .not().isEmpty().withMessage('Dataset filename cannot be empty'),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  console.log('request body', req.body);

  let _workspace = await Workspace.findOne({
    where: {
      id: req.body.workspaceId
    }, include: [{
      model: User,
      through: { userId: req.session.user.id }
    }]
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Dataset could not be saved' });
  });

  let imported = req.body.imported || 0;

  if (_workspace.Users[0].dataValues.id !== req.session.user.id) {
    return res.status(403).send('Forbidden');
  }

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
        workspaceId: req.body.workspaceId,
        imported: imported
      }).then((dataset) => {
        if (imported == 1) {
          return res.json({ success: true, data: dataset });
        }

        let profileFilePath = process.cwd() + '/workspaces/' + dataset.workspaceId + '/datasets/' +
              dataset.id + '/',
            fileExtension = req.body.filename.substr(req.body.filename.lastIndexOf('.') + 1).toLowerCase(),
            _filePath = "~" + req.session.user.username + "::" + req.body.workspaceName + "::" + dataset.filename,
            dsType = '';

        switch(fileExtension) {
          case 'json':
            dsType = "JSON('" + (req.body.rowpath ? req.body.rowpath : "/") + "')";
            break;
          case 'csv':
          default:
            dsType = "CSV";
            break;
        }
        let _dpEcl = "IMPORT STD.DataPatterns;\nfilePath := '" + _filePath +
          "';\n" + req.body.layout + ";\nds := DATASET(filePath, Layout, " + dsType +");\n" +
          "profileResults := DataPatterns.Profile(ds,,,,'best_ecl_types',5);\n" +
          "OUTPUT(profileResults, ALL, NAMED('profileResults'));";

        if (!fs.existsSync(profileFilePath)) {
          fs.mkdirpSync(profileFilePath);
        }

        fs.closeSync(fs.openSync(profileFilePath + dataset.name + '-profile.ecl', 'w'));
        fs.writeFileSync(profileFilePath + dataset.name + '-profile.ecl', _dpEcl);

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
router.put('/', [
  body('id')
    .isUUID(4).withMessage('Invalid dataset id'),
  body('workspaceId')
    .isUUID(4).withMessage('Invalid workspace id'),
  body('name')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_]*$/).withMessage('Invalid dataset name'),
  body('filename')
    .matches(/^[a-zA-Z]{1}[a-zA-Z0-9_]*$/).withMessage('Invalid dataset file name'),
  body('logicalfile')
    .matches(/^[-a-zA-Z0-9\._:]+$/).withMessage('Invalid logical file name'),
  body('rowCount')
    .isInt().withMessage('Invalid row count'),
], async (req, res, next) => {

  let _workspace = await Workspace.findOne({
    where: {
      id: req.body.workspaceId
    }, include: [{
      model: User,
      through: { userId: req.session.user.id }
    }]
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Dataset could not be saved' });
  });

  if (_workspace.Users[0].dataValues.id !== req.session.user.id) {
    return res.status(403).send('Forbidden');
  }

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
    dataset.getWorkspace({
      include: [{
        model: User,
        through: { userId: req.session.user.id }
      }]
    }).then(workspace => {
      if (workspace.Users[0].dataValues.id !== req.session.user.id) {
        return res.status(403).send('Forbidden');
      }

      let datasetFilePath = process.cwd() + '/workspaces/' + dataset.workspaceId + '/datasets/' + dataset.id
      console.log('if path exists - ' + datasetFilePath);
      if (fs.existsSync(datasetFilePath)) {
        console.log('removeSync - ' + datasetFilePath);
        fs.removeSync(datasetFilePath);
      }
      Workunit.destroy({
        where: { objectId: dataset.id }
      });
      Dataset.destroy({
        where: { id: dataset.id }
      }).then(() => {
        return res.json({ success: true, message: 'Dataset deleted' });
      });
    })
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Dataset could not be deleted' });
  });
});

/* Delete multiple datasets */
router.delete('/batch', (req, res, next) => {
  console.log('request body', req.body);
  Dataset.findAll({
    where: {
      id: { [db.Sequelize.Op.in]: req.body.ids },
    }
  }).then((datasets) => {
    datasets.forEach((dataset) => {
      console.log(dataset.name, dataset.id);
      let datasetFilePath = process.cwd() + '/workspaces/' + dataset.workspaceId +
        '/datasets/' + dataset.id + '/' + dataset.name + '.ecl';
      if (fs.existsSync(datasetFilePath)) {
        fs.unlinkSync(datasetFilePath);
      }
      Dataset.destroy({
        where: { id: dataset.id }
      });
    });
  }).then(() => {
    res.json({ success: true, message: 'Datasets deleted' });
  }).catch((err) => {
    console.log(err);
    return res.json({ success: false, message: 'Datasets could not be deleted' });
  });
});

module.exports = router;