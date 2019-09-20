'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addIndex('ScriptRevisions', ['scriptId'], {
      name: 'idx_ScriptRevisions_scriptId',
      fields: 'scriptId',
      unique: false
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeIndex('ScriptRevisions', 'idx_ScriptRevisions_scriptId');
  }
};
