'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('ScriptRevisions', 'content', {
      type: Sequelize.TEXT('medium')
    })
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('ScriptRevisions', 'content', {
      type: Sequelize.STRING('8192')
    })
  }
};
