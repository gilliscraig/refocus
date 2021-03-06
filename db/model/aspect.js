/**
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * db/model/aspect.js
 */

const common = require('../helpers/common');
const u = require('../helpers/aspectUtils');
const constants = require('../constants');

const assoc = {};
const timeoutLength = 10;
const timeoutRegex = /^[0-9]{1,9}[SMHDsmhd]$/;
const valueLabelLength = 10;

module.exports = function aspect(seq, dataTypes) {
  const Aspect = seq.define('Aspect', {
    description: {
      type: dataTypes.STRING(constants.fieldlen.longish),
    },
    helpEmail: {
      type: dataTypes.STRING(constants.fieldlen.email),
      validate: { isEmail: true },
    },
    helpUrl: {
      type: dataTypes.STRING(constants.fieldlen.url),
      validate: { isUrl: true },
    },
    id: {
      type: dataTypes.UUID,
      primaryKey: true,
      defaultValue: dataTypes.UUIDV4,
    },
    isDeleted: {
      type: dataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
    },
    imageUrl: {
      type: dataTypes.STRING(constants.fieldlen.url),
      validate: { isUrl: true },
    },
    isPublished: {
      type: dataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    name: {
      type: dataTypes.STRING(constants.fieldlen.normalName),
      allowNull: false,
      validate: {
        is: constants.nameRegex,
      },
    },
    criticalRange: {
      type: dataTypes.ARRAY(dataTypes.FLOAT),
      allowNull: true,
      validate: {
        rangeOk: u.validateStatusRange,
      },
    },
    warningRange: {
      type: dataTypes.ARRAY(dataTypes.FLOAT),
      allowNull: true,
      validate: {
        rangeOk: u.validateStatusRange,
      },
    },
    infoRange: {
      type: dataTypes.ARRAY(dataTypes.FLOAT),
      allowNull: true,
      validate: {
        rangeOk: u.validateStatusRange,
      },
    },
    okRange: {
      type: dataTypes.ARRAY(dataTypes.FLOAT),
      allowNull: true,
      validate: {
        rangeOk: u.validateStatusRange,
      },
    },
    timeout: {
      type: dataTypes.STRING(timeoutLength),
      allowNull: false,
      validate: {
        is: timeoutRegex,
      },
    },
    valueLabel: {
      type: dataTypes.STRING(valueLabelLength),
    },
    valueType: {
      type: dataTypes.ENUM('BOOLEAN', 'NUMERIC', 'PERCENT'),
      defaultValue: 'BOOLEAN',
    },
    relatedLinks: {
      type: dataTypes.ARRAY(dataTypes.JSON),
      allowNull: true,
      defaultValue: constants.defaultJsonArrayValue,
      validate: {
        validateJsonSchema(value) {
          common.validateJsonSchema(value);
        },
      },
    },
  }, {
    classMethods: {
      getAspectAssociations() {
        return assoc;
      },

      postImport(models) {
        assoc.createdBy = Aspect.belongsTo(models.User, {
          foreignKey: 'createdBy',
        });
        assoc.samples = Aspect.hasMany(models.Sample, {
          as: 'samples',
          foreignKey: 'aspectId',
          hooks: true,
        });
        assoc.tags = Aspect.hasMany(models.Tag, {
          foreignKey: 'associationId',
          constraints: false,
          scope: {
            associatedModelName: 'Aspect',
          },
          as: 'tags',
        });
        Aspect.addScope('defaultScope', {
          include: [

            // assoc.createdBy,
            assoc.tags,
          ],
          order: ['Aspect.name'],
        }, {
          override: true,
        });
        Aspect.addScope('withSamples', {
          include: [
            {
              association: assoc.samples,
              attributes: { exclude: ['aspectId'] },
            },
          ],
        });
        Aspect.addScope('tagNameIn', (tagNames) => {
          return {
            include: [
              {
                model: models.Tag,
                association: assoc.tags,
                attributes: ['name'],
                where: {
                  name: { $in: tagNames },
                },
              },
            ],
          };
        });
      },
    },
    hooks: {

      /**
       * Set the isDeleted timestamp.
       *
       * @param {Aspect} inst - The instance being destroyed
       * @returns {Promise}
       */
      beforeDestroy(inst /* , opts */) {
        return new seq.Promise((resolve, reject) =>
          common.setIsDeleted(seq.Promise, inst)
          .then(() => inst.getSamples())
          .each((samp) => samp.destroy())
          .then(() => resolve(inst))
          .catch((err) => reject(err))
        );
      }, // hooks.beforeDestroy

      /**
       * Recalculate sample status if any of the status ranges changed.
       *
       * @param {Aspect} inst - The instance being updated
       * @returns {Promise}
       */
      beforeUpdate(inst /* , opts */) {
        const statusRangeWasUpdated = inst.changed('criticalRange') ||
          inst.changed('warningRange') ||
          inst.changed('infoRange') ||
          inst.changed('okRange');
        if (statusRangeWasUpdated) {
          return new seq.Promise((resolve, reject) =>
            inst.getSamples()
            .each((samp) => {
              samp.aspect = inst;
              samp.calculateStatus();
              samp.setStatusChangedAt();
              samp.save();
            })
            .then(() => resolve(inst))
            .catch((err) => reject(err))
          );
        }
      }, // hooks.beforeUpdate

      /**
       * If isPublished is being updated from true to false, delete any samples
       * which are associated with the aspect.
       *
       * @param {Aspect} inst - The updated instance
       * @returns {Promise}
       */
      afterUpdate(inst /* , opts */) {
        if (inst.changed('isPublished') &&
          inst.previous('isPublished') &&
          !inst.getDataValue('isPublished')) {
          return new seq.Promise((resolve, reject) =>
            inst.getSamples()
            .each((samp) => samp.destroy())
            .then(() => resolve(inst))
            .catch((err) => reject(err))
          );
        }

        return seq.Promise.resolve();
      }, // hooks.afterUpdate

      /**
       * Makes sure isUrl/isEmail validations will handle empty strings
       * appropriately.
       *
       * @param {Aspect} inst - The instance being validated
       * @returns {undefined} - OK
       */
      beforeValidate(inst /* , opts */) {
        if (inst.changed('helpUrl') &&
          inst.helpUrl !== null &&
          inst.helpUrl.length === 0) {
          inst.helpUrl = null;
        }

        if (inst.changed('imageUrl') &&
          inst.imageUrl !== null &&
          inst.imageUrl.length === 0) {
          inst.imageUrl = null;
        }

        if (inst.changed('helpEmail') &&
          inst.helpEmail !== null &&
          inst.helpEmail.length === 0) {
          inst.helpEmail = null;
        }
      },

    }, // hooks
    indexes: [
      {
        name: 'AspectUniqueLowercaseNameIsDeleted',
        unique: true,
        fields: [
          seq.fn('lower', seq.col('name')),
          'isDeleted',
        ],
      },
    ],
    paranoid: true,
  });

  return Aspect;
};
