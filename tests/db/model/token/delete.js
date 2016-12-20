/**
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or
 * https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * tests/db/model/token/delete.js
 */

'use strict';  // eslint-disable-line strict

const expect = require('chai').expect;
const tu = require('../../../testUtils');
const u = require('./utils');
const Token = tu.db.Token;

describe('db: Token: delete', () => {
  let tokenObj = {};
  beforeEach((done) => {
    u.createTokenObject()
    .then((createdTokenObj) => {
      tokenObj = createdTokenObj;
      done();
    })
    .catch((err) => done(err));
  });
  afterEach(u.forceDelete);

  it('Delete token object', (done) => {
    Token.findById(tokenObj.id)
    .then((returnedToken) => returnedToken.destroy())
    .then((delToken) => {
      expect(delToken.isDeleted).to.not.equal('0');
      return Token.findById(tokenObj.id);
    })
    .then((rToken) => {
      expect(rToken).to.be.equal(null);
      done();
    })
    .catch(done);
  });
});

describe('db: System Token: delete', () => {
  let t;
  beforeEach((done) => {
    u.createSystemToken()
    .then((token) => {
      t = token;
      done();
    })
    .catch(done);
  });
  afterEach(u.forceDelete);
  it('Not allowed to delete system token', (done) => {
    Token.findOne({ where: { name: t.name } })
    .then((token) => token.destroy())
    .then(() => done('expecting error here'))
    .catch((err) => {
      expect(err).to.have.property('name', 'TokenDeleteConstraintError');
      done();
    });
  });
});