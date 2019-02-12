'use strict';
module.exports = (sequelize, DataTypes) => {
  const roles = {
    'OWNER': 'OWNER',
    'CONTRIBUTOR': 'CONTRIBUTOR',
    'GUEST': 'GUEST'
  };

  const WorkspaceUser = sequelize.define('WorkspaceUser', {
    role: {
      type: DataTypes.ENUM,
      values: Object.keys(roles),
      defaultValue: 'GUEST',
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.UUID,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      primaryKey: true
    }
  }, {});
  WorkspaceUser.associate = function(models) {
    // associations can be defined here
  };
  WorkspaceUser.roles = roles;

  return WorkspaceUser;
};