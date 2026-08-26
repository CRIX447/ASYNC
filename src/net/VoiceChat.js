import { VOICE } from '../config/manifest.js';

/**
 * Proximity voice chat over WebRTC.
 *
 * Signalling (the "who are you and how do I reach you" handshake) rides on the
 * WebSocket you already have. Once peers are introduced, audio flows directly
 * browser-to-browser -- it never touches your server, so voice costs you
 * nothing in bandwidth no matter how many people play.
 *
 * Volume falls off with distance, so you hear teammates get quieter as they
 * wander off. That's most of the fun of co-op horror.
 */
export class VoiceChat {
  constructor(session) {
    this.session = session;
    this.peers = new Map();     // id -> { pc, audio, gain }
    this.enabled = false;
    this.talking = false;
    this.stream = null;
    this.ctx = null;

    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    this.onStatus = () => {};
  }

  /** Must be called from a user gesture -- browsers require it for mic access. */
  async enable() {
    if (this.enabled || !VOICE.enabled) return false;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err) {
      console.warn('Microphone denied or unavailable:', err.message);
      this.onStatus({ enabled: false, error: 'MIC BLOCKED' });
      return false;
    }

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.enabled = true;

    // Start muted; push-to-talk opens the gate.
    this._setTrackEnabled(VOICE.openMic);
    this.talking = VOICE.openMic;

    this._bindSignalling();
    this.session.send?.({ t: 'voice-join' });
    this.onStatus({ enabled: true });
    return true;
  }

  _setTrackEnabled(on) {
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = on));
  }

  setTalking(on) {
    if (!this.enabled || VOICE.openMic) return;
    if (on === this.talking) return;
    this.talking = on;
    this._setTrackEnabled(on);
    this.onStatus({ enabled: true, talking: on });
  }

  _bindSignalling() {
    this.session.on('voice-peer', ({ id, initiator }) => this._connect(id, initiator));
    this.session.on('voice-signal', ({ from, data }) => this._signal(from, data));
    this.session.on('voice-leave', ({ id }) => this._drop(id));
  }

  async _connect(id, initiator) {
    if (this.peers.has(id)) return;

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const entry = { pc, audio: null, gain: null };
    this.peers.set(id, entry);

    this.stream.getTracks().forEach((t) => pc.addTrack(t, this.stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.session.send?.({ t: 'voice-signal', to: id, data: { candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      // Routed through a GainNode so distance can drive the volume.
      const src = this.ctx.createMediaStreamSource(e.streams[0]);
      const gain = this.ctx.createGain();
      gain.gain.value = 1;
      src.connect(gain).connect(this.ctx.destination);
      entry.gain = gain;

      // Safari won't play a remote stream unless it's attached to an element.
      const el = new Audio();
      el.srcObject = e.streams[0];
      el.muted = true;
      el.play().catch(() => {});
      entry.audio = el;
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.session.send?.({ t: 'voice-signal', to: id, data: { sdp: pc.localDescription } });
    }
  }

  async _signal(from, data) {
    let entry = this.peers.get(from);
    if (!entry) {
      await this._connect(from, false);
      entry = this.peers.get(from);
    }
    if (!entry) return;

    const { pc } = entry;

    if (data.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.session.send?.({ t: 'voice-signal', to: from, data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch { /* candidate arrived before the description; harmless */ }
    }
  }

  _drop(id) {
    const entry = this.peers.get(id);
    if (!entry) return;
    entry.pc.close();
    entry.audio?.pause();
    this.peers.delete(id);
  }

  /** Called every frame with where everyone is, to fade distant voices. */
  updateProximity(myPos, remotePlayers) {
    if (!this.enabled || !VOICE.proximity) return;

    for (const [id, entry] of this.peers) {
      if (!entry.gain) continue;
      const other = remotePlayers.get?.(id);
      if (!other) continue;

      const d = Math.hypot(other.group.position.x - myPos.x, other.group.position.z - myPos.z);
      const v = Math.max(0, 1 - d / VOICE.maxDistance);
      entry.gain.gain.value = v * v; // squared falloff reads as more natural
    }
  }

  disable() {
    this.peers.forEach((_, id) => this._drop(id));
    this.stream?.getTracks().forEach((t) => t.stop());
    this.session.send?.({ t: 'voice-leave' });
    this.enabled = false;
    this.onStatus({ enabled: false });
  }
}
