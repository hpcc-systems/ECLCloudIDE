'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.removeConstraint('Workunits', 'PRIMARY')
      .then(() => {
         return queryInterface.addIndex('Workunits', ['workunitId'], {
          name: 'idx_Workunits_workunitId',
          fields: 'workunitId',
          unique: false
        });
      });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeIndex('Workunits', 'idx_Workunits_workunitId')
      .then(() => {
         return queryInterface.addConstraint('Workunits', ['workunitId'], {
          name: 'workunits_workunitId',
          type: 'primary key',
        });
      });
  }
};