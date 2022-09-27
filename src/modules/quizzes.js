/* eslint-disable object-curly-newline, no-underscore-dangle */
const qs = require('qs');
const fetchPonyfill = require('fetch-ponyfill');
const Promise = require('es6-promise');
const EventDispatcher = require('../utils/event-dispatcher');
const helpers = require('../utils/helpers');

// Create URL from supplied quizId and parameters
function createQuizUrl(quizId, parameters, options, path) {
  const {
    apiKey,
    clientId,
    sessionId,
    segments,
    userId,
    version,
  } = options;
  const serviceUrl = 'https://quizzes.cnstrc.com';
  let queryParams = { c: version };
  let answersParamString = '';

  queryParams.key = apiKey;
  queryParams.i = clientId;
  queryParams.s = sessionId;

  // Pull user segments from options
  if (segments && segments.length) {
    queryParams.us = segments;
  }

  // Pull user id from options
  if (userId) {
    queryParams.ui = userId;
  }

  // Validate quiz id is provided
  if (!quizId || typeof quizId !== 'string') {
    throw new Error('quizId is a required parameter of type string');
  }

  if (path === 'finalize' && (typeof parameters.a !== 'object' || !Array.isArray(parameters.a) || parameters.a.length === 0)) {
    throw new Error('a is a required parameter of type array');
  }

  if (parameters) {
    const { section, a, versionId } = parameters;

    // Pull section from parameters
    if (section) {
      queryParams.section = section;
    }

    // Pull version_id from parameters
    if (versionId) {
      queryParams.version_id = versionId;
    }

    // Pull a from parameters and transform
    if (a) {
      a.forEach((ans) => {
        answersParamString += `&${qs.stringify({ a: ans }, { arrayFormat: 'comma' })}`;
      });
    }
  }

  queryParams._dt = Date.now();
  queryParams = helpers.cleanParams(queryParams);

  const queryString = qs.stringify(queryParams, { indices: false });

  return `${serviceUrl}/v1/quizzes/${encodeURIComponent(quizId)}/${encodeURIComponent(path)}/?${queryString}${answersParamString}`;
}

/**
 * Interface to quiz related API calls
 *
 * @module quizzes
 * @inner
 * @returns {object}
 */
class Quizzes {
  constructor(options) {
    this.options = options || {};
    this.eventDispatcher = new EventDispatcher(options.eventDispatcher);
  }

  /**
   * Retrieve next quiz from api
   *
   * @function getNextQuiz
   * @description Retrieve next quiz from Constructor.io API
   * @param {string} id - The id of the quiz
   * @param {string} [parameters] - Additional parameters to refine result set
   * @param {string} [parameters.section] - Section for customer's product catalog (optional)
   * @param {array} [parameters.a] - An array for answers in the format [[1,2],[1]]
   * @param {string} [parameters.version_id] - Specific version id for the quiz.
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {Promise}
   * @see https://quizzes.cnstrc.com/api/#/quizzes/QuizzesController_getNextQuestion
   * @example
   * constructorio.search.getNextQuiz('quizId', {
   *    a: [[1,2],[1]],
   *    section: "123",
   *    version_id: "123"
   * });
   */
  getNextQuiz(quizId, parameters, networkParameters = {}) {
    let requestUrl;
    const fetch = (this.options && this.options.fetch) || fetchPonyfill({ Promise }).fetch;
    const controller = new AbortController();
    const { signal } = controller;

    try {
      requestUrl = createQuizUrl(quizId, parameters, this.options, 'next');
    } catch (e) {
      return Promise.reject(e);
    }

    // Handle network timeout if specified
    helpers.applyNetworkTimeout(this.options, networkParameters, controller);

    return fetch(requestUrl, { signal })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        return helpers.throwHttpErrorFromResponse(new Error(), response);
      })
      .then((json) => {
        if (json.version_id) {
          this.eventDispatcher.queue('quizzes.getNextQuiz.completed', json);
          return json;
        }
        throw new Error('getNextQuiz response data is malformed');
      });
  }

  /**
   * Retrieves filter expression and recommendation URL from given answers.
   *
   * @function getFinalizeQuiz
   * @description Retrieve quiz recommendation and filter expression from Constructor.io API
   * @param {string} id - The id of the quiz
   * @param {string} [parameters] - Additional parameters to refine result set
   * @param {string} [parameters.section] - Section for customer's product catalog (optional)
   * @param {array} [parameters.a] - An array for answers in the format [[1,2],[1]]
   * @param {string} [parameters.version_id] - Specific version id for the quiz.
   * @param {object} [networkParameters] - Parameters relevant to the network request
   * @param {number} [networkParameters.timeout] - Request timeout (in milliseconds)
   * @returns {Promise}
   * @see https://quizzes.cnstrc.com/api/#/quizzes/QuizzesController_getQuizResult
   * @example
   * constructorio.search.getFinalizeQuiz('quizId', {
   *    a: [[1,2],[1]],
   *    section: "123",
   *    version_id: "123"
   * });
   */
  getFinalizeQuiz(quizId, parameters, networkParameters = {}) {
    let requestUrl;
    const fetch = (this.options && this.options.fetch) || fetchPonyfill({ Promise }).fetch;
    const controller = new AbortController();
    const { signal } = controller;

    try {
      requestUrl = createQuizUrl(quizId, parameters, this.options, 'finalize');
    } catch (e) {
      return Promise.reject(e);
    }

    // Handle network timeout if specified
    helpers.applyNetworkTimeout(this.options, networkParameters, controller);

    return fetch(requestUrl, { signal })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }

        return helpers.throwHttpErrorFromResponse(new Error(), response);
      })
      .then((json) => {
        if (json.version_id) {
          this.eventDispatcher.queue('quizzes.getFinalizeQuiz.completed', json);
          return json;
        }

        throw new Error('getFinalizeQuiz response data is malformed');
      });
  }
}

module.exports = Quizzes;
