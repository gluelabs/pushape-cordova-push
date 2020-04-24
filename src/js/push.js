/*!
 * Module dependencies.
 */
let exec;

if (typeof cordova !== 'undefined') {
  exec = cordova.require('cordova/exec');
}

const prepareAjax = () => {
  const ajax = {};

  ajax.x = function () {
    if (typeof XMLHttpRequest !== 'undefined') {
      return new XMLHttpRequest();
    }
    const versions = [
      'MSXML2.XmlHttp.6.0',
      'MSXML2.XmlHttp.5.0',
      'MSXML2.XmlHttp.4.0',
      'MSXML2.XmlHttp.3.0',
      'MSXML2.XmlHttp.2.0',
      'Microsoft.XmlHttp'
    ];
  
    let xhr;
    for (let i = 0; i < versions.length; i++) {
      try {
        xhr = new ActiveXObject(versions[i]);
        break;
      } catch (e) { }
    }
    return xhr;
  };
  
  ajax.send = function (url, method, data, callback, errback, async) {
    if (async === undefined) {
      async = true;
    }
    const x = ajax.x();
    x.open(method, url, async);
    x.onreadystatechange = function () {
      if (x.readyState == 4) {
        if (x.status >= 400 || x.status === 0) {
          errback(x);
        } else {
          callback(x.responseText);
        }
      }
    };
  
    x.setRequestHeader('Content-type', 'application/json');
    x.send(data);
  };
  
  ajax.post = function (url, data, callback, errback, async) {
    ajax.send(url, 'POST', JSON.stringify(data), callback, errback, async);
  };

  ajax.delete = function(url, data, callback, errback, async) {
    ajax.send(url, 'DELETE', JSON.stringify(data), callback, errback, async);
  }

  return ajax;
}

/**
 *
 * @param {string} idApp
 * @param {ios | android | chrome} platform
 * @param {string} uuid
 * @param {string} regid
 * @param {string} internalId
 */
const registerPushape = (idApp, platform, uuid, regid, internalId) => {
  const ajax = prepareAjax();

  const payload = {
    id_app: idApp,
    platform: platform,
    uuid: uuid,
    regid: regid,
  };
  if (!(typeof internalId == 'undefined' || internalId == null)) {
    payload['internal_id'] = internalId;
  }

  return new Promise((resolve) => {
    ajax.post(
      'https://api.pushape.com/subscribe',
      payload,
      function (res) {
        console.log('[Pushape] Registation Successfull');
        resolve(res);
      },
      function (err) {
        console.error('[Pushape] Retrying registration to Pushape in 10 seconds', err);

        setTimeout(function () {
          registerPushape(idApp, platform, uuid, regid, internalId);
        }, 10000);
      });
  });
}

/**
 *
 * @param {string} idApp
 * @param {ios | android | chrome} platform
 * @param {string} uuid
 * @param {string} regid
 * @param {string} internalId
 */
const unregisterPushape = (idApp, platform, uuid, regid, internalId) => {
  const ajax = prepareAjax();

  const payload = {
    id_app: idApp,
    platform: platform,
    uuid: uuid,
    regid: regid,
  };
  if (!(typeof internalId == 'undefined' || internalId == null)) {
    payload['internal_id'] = internalId;
  }

  return new Promise((resolve) => {
    ajax.delete(
      'https://api.pushape.com/subscribe',
      payload,
      function (res) {
        console.log('[Pushape] Unregistation Successfull');
        resolve(res);
      },
      function (err) {
        console.error('[Pushape] Retrying unregistration to Pushape in 10 seconds', err);

        setTimeout(function () {
          unregisterPushape(idApp, platform, uuid, regid, internalId);
        }, 10000);
      });
  });
}

class PushNotification {
  /**
   * PushNotification constructor.
   *
   * @param {Object} options to initiate Push Notifications.
   * @return {PushNotification} instance that can be monitored and cancelled.
   */
  constructor(options) {
    this.handlers = {
      registration: [],
      notification: [],
      error: [],
    };

    // require options parameter
    if (typeof options === 'undefined') {
      throw new Error('The options argument is required.');
    }

    // store the options to this object instance
    this.options = options;

    // triggered on registration and notification
    const success = (result) => {
      if (result && typeof result.registrationId !== 'undefined') {
        registerPushape(
          options.pushape.id_app,
          options.pushape.platform,
          options.pushape.uuid,
          result.registrationId,
          options.id_user,
        ).then((result) => {
          this.emit('registration', result);
        });
      } else if (
        result
        && result.additionalData
        && typeof result.additionalData.actionCallback !== 'undefined'
      ) {
        this.emit(result.additionalData.actionCallback, result);
      } else if (result) {
        this.emit('notification', result);
      }
    };

    // triggered on error
    const fail = (msg) => {
      const e = typeof msg === 'string' ? new Error(msg) : msg;
      this.emit('error', e);
    };

    // wait at least one process tick to allow event subscriptions
    setTimeout(() => {
      exec(success, fail, 'PushNotification', 'init', [options]);
    }, 10);
  }

  /**
   * Unregister from push notifications
   */
  unregister(successCallback, errorCallback = () => { }, options) {
    if (typeof errorCallback !== 'function') {
      console.log('PushNotification.unregister failure: failure parameter not a function');
      return;
    }

    if (typeof successCallback !== 'function') {
      console.log(
        'PushNotification.unregister failure: success callback parameter must be a function',
      );
      return;
    }

    const cleanHandlersAndPassThrough = () => {
      if (!options) {
        this.handlers = {
          registration: [],
          notification: [],
          error: [],
        };
      }

      unregisterPushape().then(() => {
        successCallback();
      });
    };

    exec(cleanHandlersAndPassThrough, errorCallback, 'PushNotification', 'unregister', [options]);
  }

  /**
   * subscribe to a topic
   * @param   {String}      topic               topic to subscribe
   * @param   {Function}    successCallback     success callback
   * @param   {Function}    errorCallback       error callback
   * @return  {void}
   */
  subscribe(topic, successCallback, errorCallback = () => { }) {
    if (typeof errorCallback !== 'function') {
      console.log('PushNotification.subscribe failure: failure parameter not a function');
      return;
    }

    if (typeof successCallback !== 'function') {
      console.log(
        'PushNotification.subscribe failure: success callback parameter must be a function',
      );
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'subscribe', [topic]);
  }

  /**
   * unsubscribe to a topic
   * @param   {String}      topic               topic to unsubscribe
   * @param   {Function}    successCallback     success callback
   * @param   {Function}    errorCallback       error callback
   * @return  {void}
   */
  unsubscribe(topic, successCallback, errorCallback = () => { }) {
    if (typeof errorCallback !== 'function') {
      console.log('PushNotification.unsubscribe failure: failure parameter not a function');
      return;
    }

    if (typeof successCallback !== 'function') {
      console.log(
        'PushNotification.unsubscribe failure: success callback parameter must be a function',
      );
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'unsubscribe', [topic]);
  }

  /**
   * Call this to set the application icon badge
   */
  setApplicationIconBadgeNumber(successCallback, errorCallback = () => { }, badge) {
    if (typeof errorCallback !== 'function') {
      console.log(
        'PushNotification.setApplicationIconBadgeNumber failure: failure '
        + 'parameter not a function',
      );
      return;
    }

    if (typeof successCallback !== 'function') {
      console.log(
        'PushNotification.setApplicationIconBadgeNumber failure: success '
        + 'callback parameter must be a function',
      );
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'setApplicationIconBadgeNumber', [
      { badge },
    ]);
  }

  /**
   * Get the application icon badge
   */

  getApplicationIconBadgeNumber(successCallback, errorCallback = () => { }) {
    if (typeof errorCallback !== 'function') {
      console.log(
        'PushNotification.getApplicationIconBadgeNumber failure: failure '
        + 'parameter not a function',
      );
      return;
    }

    if (typeof successCallback !== 'function') {
      console.log(
        'PushNotification.getApplicationIconBadgeNumber failure: success '
        + 'callback parameter must be a function',
      );
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'getApplicationIconBadgeNumber', []);
  }

  /**
   * Clear all notifications
   */

  clearAllNotifications(successCallback = () => { }, errorCallback = () => { }) {
    if (typeof errorCallback !== 'function') {
      console.log(
        'PushNotification.clearAllNotifications failure: failure parameter not a function',
      );
      return;
    }

    if (typeof successCallback !== 'function') {
      console.log(
        'PushNotification.clearAllNotifications failure: success callback '
        + 'parameter must be a function',
      );
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'clearAllNotifications', []);
  }

  /**
   * Clears notifications that have the ID specified.
   * @param  {Function} [successCallback] Callback function to be called on success.
   * @param  {Function} [errorCallback] Callback function to be called when an error is encountered.
   * @param  {Number} id    ID of the notification to be removed.
   */
  clearNotification(successCallback = () => { }, errorCallback = () => { }, id) {
    const idNumber = parseInt(id, 10);
    if (Number.isNaN(idNumber) || idNumber > Number.MAX_SAFE_INTEGER || idNumber < 0) {
      console.log(
        'PushNotification.clearNotification failure: id parameter must'
        + 'be a valid integer.',
      );
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'clearNotification',
      [idNumber]);
  }

  /**
   * Listen for an event.
   *
   * The following events are supported:
   *
   *   - registration
   *   - notification
   *   - error
   *
   * @param {String} eventName to subscribe to.
   * @param {Function} callback triggered on the event.
   */

  on(eventName, callback) {
    if (!Object.prototype.hasOwnProperty.call(this.handlers, eventName)) {
      this.handlers[eventName] = [];
    }
    this.handlers[eventName].push(callback);
  }

  /**
   * Remove event listener.
   *
   * @param {String} eventName to match subscription.
   * @param {Function} handle function associated with event.
   */

  off(eventName, handle) {
    if (Object.prototype.hasOwnProperty.call(this.handlers, eventName)) {
      const handleIndex = this.handlers[eventName].indexOf(handle);
      if (handleIndex >= 0) {
        this.handlers[eventName].splice(handleIndex, 1);
      }
    }
  }

  /**
   * Emit an event.
   *
   * This is intended for internal use only.
   *
   * @param {String} eventName is the event to trigger.
   * @param {*} all arguments are passed to the event listeners.
   *
   * @return {Boolean} is true when the event is triggered otherwise false.
   */

  emit(...args) {
    const eventName = args.shift();

    if (!Object.prototype.hasOwnProperty.call(this.handlers, eventName)) {
      return false;
    }

    for (let i = 0, { length } = this.handlers[eventName]; i < length; i += 1) {
      const callback = this.handlers[eventName][i];
      if (typeof callback === 'function') {
        callback(...args);
      } else {
        console.log(`event handler: ${eventName} must be a function`);
      }
    }

    return true;
  }

  finish(successCallback = () => { }, errorCallback = () => { }, id = 'handler') {
    if (typeof successCallback !== 'function') {
      console.log('finish failure: success callback parameter must be a function');
      return;
    }

    if (typeof errorCallback !== 'function') {
      console.log('finish failure: failure parameter not a function');
      return;
    }

    exec(successCallback, errorCallback, 'PushNotification', 'finish', [id]);
  }
}

/*!
 * Push Notification Plugin.
 */

module.exports = {
  /**
   * Register for Push Notifications.
   *
   * This method will instantiate a new copy of the PushNotification object
   * and start the registration process.
   *
   * @param {Object} options
   * @return {PushNotification} instance
   */

  init: (options) => new PushNotification(options),

  hasPermission: (successCallback, errorCallback) => {
    exec(successCallback, errorCallback, 'PushNotification', 'hasPermission', []);
  },

  createChannel: (successCallback, errorCallback, channel) => {
    exec(successCallback, errorCallback, 'PushNotification', 'createChannel', [channel]);
  },

  deleteChannel: (successCallback, errorCallback, channelId) => {
    exec(successCallback, errorCallback, 'PushNotification', 'deleteChannel', [channelId]);
  },

  listChannels: (successCallback, errorCallback) => {
    exec(successCallback, errorCallback, 'PushNotification', 'listChannels', []);
  },

  /**
   * PushNotification Object.
   *
   * Expose the PushNotification object for direct use
   * and testing. Typically, you should use the
   * .init helper method.
   */
  PushNotification,
};
