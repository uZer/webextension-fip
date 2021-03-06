import browser from 'webextension-polyfill';

import {states} from '../lib/radio.js';
import Steps from '../lib/steps.js';
import LastfmAPI from '../lib/lastfm.js';

export default class ScrobblingController {
  constructor ({ preferences }) {
    this.previousBroadcast = {};
    this.preferences = preferences;

    this.client = new LastfmAPI(preferences.get('lastfm.token'));
  }

  static init(options) {
    return new ScrobblingController(options);
  }

  updateUserInfos(token){
    const {preferences} = this;

    return this.client.getSessionKey(token).then(data => {
      this.client.session_key = data.sessionKey;

      preferences.set('lastfm.token', data.sessionKey);
      preferences.set('lastfm.username', data.userName);
      preferences.set('lastfm.scrobbling', true);

      const port = browser.runtime.connect();
      port.postMessage('lastfm.auth.success');

      return data;
    });
  }

  scrobble(steps) {
    const radioState = this.preferences.get('radio.state');
    const isScrobblingEnabled = this.preferences.get('lastfm.scrobbling', true);

    if (radioState !== states.PLAYING || isScrobblingEnabled === false) {
      return;
    }

    const current = Steps.getCurrent(steps);

    this.processNowPlaying(current);
    this.processScrobbling(current);

    if (current && current.title !== this.previousBroadcast.title) {
      this.previousBroadcast = current;
    }
  }

  handleAuthResponse(url) {
    url.replace(/token=([^&]+)/, (m, token) => {
      this.updateUserInfos(token);
    });
  }

  processNowPlaying(step) {
    if (!this.client.isConfigured() || !step) {
      return;
    }

    const previous = this.previousBroadcast;

    if (step && step.authors && step.title !== previous.title && step.authors !== previous.authors) {
      this.client.nowPlaying({
        artist: step.authors,
        track: step.title
      });
    }
  }

  processScrobbling(step) {
    if (!this.client.isConfigured() || !step) {
      return;
    }

    var previous = this.previousBroadcast;

    if (step && previous.authors && step.title !== previous.title && step.authors !== previous.authors) {
      this.client.scrobble({
        artist: previous.authors,
        track: previous.title,
        when: Date.now() - 120 // let's pretend we listened to it 2 minutes ago
      });
    }
  }
}
