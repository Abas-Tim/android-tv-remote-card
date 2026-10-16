const CARD_TAG = 'androidtv-remote-card';
const VOLUME_ROLLER_ROW_HEIGHT = 32;

function forwardHaptic(element, type) {
  element.dispatchEvent(new CustomEvent('haptic', {
    bubbles: true,
    composed: true,
    detail: type,
  }));
}

const STYLES = `
  * {
    box-sizing: border-box;
    user-select: none;
  }
  :host {
    --remote-bg: #0E0E0F;
    --remote-ui-bg: #212121;
    --remote-ui-bg-highlight: #313131;
    --remote-text: #E8EAED;
    -webkit-tap-highlight-color: transparent;
    --remote-button-size: 5rem;
    display: block;
    height: calc(var(--safe-height, 100%) - var(--ha-space-12, 0px) - 2rem);
    min-height: 400px;
  }
  ha-card {
    display: block;
    background: var(--remote-bg);
    overflow: hidden;
    height: 100%;
  }
  .container {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 1rem;
    height: 100%;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }
  h1 {
    margin: 0;
    color: var(--remote-text);
    font-size: 18px;
  }
  .trackpad {
    touch-action: none;
    background: var(--remote-ui-bg);
    min-height: 150px;
    flex-shrink: 1;
    border-radius: 1rem;
    position: relative;
    flex-grow: 1;
  }
  .trackpad.clicked {
    background: var(--remote-ui-bg-highlight);
  }
  .trackpad__ball {
    position: absolute;
    font-size: 3.375rem;
    width: 1em;
    height: 1em;
    border-radius: 2em;
    background: var(--remote-text);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    will-change: margin, opacity;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .trackpad__ball.moving {
    opacity: 0.6;
  }
  .trackpad__ball.finished {
    transition: all 0.3s ease;
  }
  .controls {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }
  .header {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .header__buttons {
    display: flex;
    gap: 1rem;
    margin: 0 0 0 auto;
    --remote-button-size: 3rem;
  }
  .ui-button {
    --bg: var(--remote-ui-bg);
    --face: var(--remote-text);
    font-size: 1rem;
    width: var(--remote-button-size);
    height: var(--remote-button-size);
    background: var(--bg);
    border: none;
    border-radius: var(--remote-button-size);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
  .ui-button ha-icon {
    --mdc-icon-size: 2rem;
    width: 2rem;
    height: 2rem;
    margin: auto;
    color: var(--face);
  }
  .ui-button:active {
    --bg: var(--remote-text);
    --face: var(--remote-bg);
  }
  .ui-button.power-on {
    --bg: var(--remote-text);
    --face: var(--remote-bg);
  }
  .ui-button.muted ha-icon {
    opacity: 0.5;
  }
  .volume-wrapper {
    position: relative;
  }
  .volume-panel {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    background: var(--remote-ui-bg);
    border-radius: 1rem;
    padding: 1rem 0.75rem;
    position: absolute;
    right: 0;
    bottom: calc(100% + 1rem);
    width: var(--remote-button-size);
  }
  .volume-panel.open {
    display: flex;
  }
  .volume-panel .ui-button {
    --remote-button-size: 3rem;
    flex-shrink: 0;
  }
  .volume-roller {
    position: relative;
    flex: 1;
    width: 100%;
    min-height: 40px;
    overflow: hidden;
    border-radius: 0.5rem;
    outline: none;
    cursor: grab;
    touch-action: none;
    mask-image: linear-gradient(transparent, black 24%, black 76%, transparent);
  }
  .volume-roller:focus-visible {
    outline: 2px solid var(--remote-text);
    outline-offset: 2px;
  }
  .volume-roller.dragging,
  .volume-roller.rolling {
    cursor: grabbing;
  }
  .volume-roller__track {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    transition: transform 120ms ease-out;
    will-change: transform;
  }
  .volume-roller.dragging .volume-roller__track,
  .volume-roller.rolling .volume-roller__track {
    transition: none;
  }
  .volume-roller__item {
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--remote-text);
    font-size: 0.9rem;
    opacity: 0.25;
  }
  .volume-roller__item.near {
    opacity: 0.6;
  }
  .volume-roller__item.selected {
    font-size: 1.1rem;
    font-weight: 600;
    opacity: 1;
  }
  .volume-roller__selection {
    position: absolute;
    top: 50%;
    left: 0.35rem;
    right: 0.35rem;
    height: 32px;
    border-top: 1px solid var(--remote-text);
    border-bottom: 1px solid var(--remote-text);
    transform: translateY(-50%);
    opacity: 0.35;
    pointer-events: none;
  }
  .volume-value {
    color: var(--remote-text);
    font-size: 0.75rem;
    text-align: center;
    font-family: monospace;
    opacity: 0.7;
  }
`;

class Remote {
  constructor(container, trackpad, trackpadBall, config = {}) {
    this.container = container;
    this.trackpad = trackpad;
    this.trackpadBall = trackpadBall;

    this.trackpadLongPress = config.trackpad_long_press === true;
    const configuredLongPressDelay = Number(config.trackpad_long_press_delay ?? 500);
    this.trackpadLongPressDelay = Number.isFinite(configuredLongPressDelay)
      ? Math.max(0, configuredLongPressDelay)
      : 500;

    this.isMoving = false;
    this.pollSteps = 3;
    this.moveDistance = 0;
    this.moveMultiplier = 1;
    this.deadZone = 0.1;
    this.fireRate = 750;
    this.currentFireRate = 750;
    this.fireEventStarted = false;
    this.fireEventTimeout = null;
    this.moveDirection = null;
    this.longPressTimer = null;
    this.longPressActive = false;
    this.gestureResetTimeout = null;
    this.clickTimeout = null;
    this.activeGesture = null;
    this.destroyed = false;

    this.events = {
      down: 'mousedown',
      move: 'mousemove',
      up: 'mouseup',
      cancel: null,
    };

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.events.down = 'touchstart';
      this.events.move = 'touchmove';
      this.events.up = 'touchend';
      this.events.cancel = 'touchcancel';
    }

    this.bindEvents();
  }

  bindEvents() {
    // A tap is handled on release, so a browser-generated click must not
    // trigger a second selection after a long press or drag.
    this.trackpad.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    });

    this.trackpad.addEventListener(this.events.down, (event) => this._startGesture(event));
  }

  _eventPoint(event) {
    const touch = event.touches?.[0] ?? event.changedTouches?.[0];
    const x = event.pageX ?? touch?.pageX;
    const y = event.pageY ?? touch?.pageY;
    return x == null || y == null ? null : { x, y };
  }

  _startGesture(event) {
    if (this.destroyed || this.activeGesture) return;
    if (event.button != null && event.button !== 0) return;

    const point = this._eventPoint(event);
    if (!point) return;

    clearTimeout(this.gestureResetTimeout);
    this.gestureResetTimeout = null;
    this.isMoving = false;
    this.trackpadBall.classList.remove('finished');

    const { width: ballSize } = this.trackpadBall.getBoundingClientRect();
    const rect = this.trackpad.getBoundingClientRect();
    const gesture = {
      startX: point.x,
      startY: point.y,
      maxX: rect.width / 2 - ballSize / 2 - 20,
      maxY: rect.height / 2 - ballSize / 2 - 20,
      moved: false,
      startFireRate: null,
      inputType: event.type === 'touchstart' ? 'touch' : 'mouse',
      onMove: null,
      onUp: null,
      onCancel: null,
      onPointerCancel: null,
    };
    this.activeGesture = gesture;

    if (this.trackpadLongPress) {
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        if (this.activeGesture !== gesture || gesture.moved) return;

        this.longPressActive = true;
        this.vibrate('medium');
        this.container.dispatchEvent(new CustomEvent('long-press-start'));
      }, this.trackpadLongPressDelay);
    }

    gesture.onMove = (moveEvent) => {
      if (this.activeGesture !== gesture) return;
      moveEvent.preventDefault();
      moveEvent.stopImmediatePropagation();

      // Once the held key has started, movement is ignored until release.
      if (this.longPressActive) return;

      const movePoint = this._eventPoint(moveEvent);
      if (!movePoint) return;

      const rawDeltaX = movePoint.x - gesture.startX;
      const rawDeltaY = movePoint.y - gesture.startY;
      const deltaX = Math.max(-gesture.maxX, Math.min(gesture.maxX, rawDeltaX * this.moveMultiplier));
      const deltaY = Math.max(-gesture.maxY, Math.min(gesture.maxY, rawDeltaY * this.moveMultiplier));

      const absXPercent = Math.abs(deltaX) / gesture.maxX;
      const absYPercent = Math.abs(deltaY) / gesture.maxY;
      const outsideDeadZone = absXPercent > this.deadZone || absYPercent > this.deadZone;

      if (outsideDeadZone) {
        gesture.moved = true;
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.isMoving = true;
      }

      if (this.isMoving) {
        const newDirection = absYPercent > absXPercent
          ? (deltaY > 0 ? 'down' : 'up')
          : (deltaX > 0 ? 'right' : 'left');

        this.moveDistance = absYPercent > absXPercent ? absYPercent : absXPercent;

        if (newDirection !== this.moveDirection || this.currentFireRate !== gesture.startFireRate) {
          this.moveDirection = newDirection;
          clearTimeout(this.fireEventTimeout);
          this.fireEventStarted = false;
        }
        gesture.startFireRate = this.currentFireRate;

        if (!this.fireEventStarted && outsideDeadZone) {
          this.trackpadBall.classList.add('moving');
          this.fireEvent();
        }

        this.trackpadBall.style.marginTop = `${deltaY}px`;
        this.trackpadBall.style.marginLeft = `${deltaX}px`;
      }
    };

    gesture.onUp = () => this._finishGesture(gesture);
    gesture.onCancel = () => this._finishGesture(gesture);
    gesture.onPointerCancel = (cancelEvent) => {
      const matchesGesture = gesture.inputType === 'touch'
        ? cancelEvent.pointerType === 'touch' || cancelEvent.pointerType === 'pen'
        : cancelEvent.pointerType === 'mouse';
      if (matchesGesture) this._finishGesture(gesture);
    };

    document.addEventListener(this.events.move, gesture.onMove);
    document.addEventListener(this.events.up, gesture.onUp);
    if (this.events.cancel) document.addEventListener(this.events.cancel, gesture.onCancel);
    document.addEventListener('pointercancel', gesture.onPointerCancel);
  }

  _finishGesture(gesture, { allowTap = true, animate = true } = {}) {
    if (this.activeGesture !== gesture) return;

    this.activeGesture = null;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
    clearTimeout(this.fireEventTimeout);
    this.fireEventTimeout = null;
    this.fireEventStarted = false;

    document.removeEventListener(this.events.move, gesture.onMove);
    document.removeEventListener(this.events.up, gesture.onUp);
    if (this.events.cancel) document.removeEventListener(this.events.cancel, gesture.onCancel);
    document.removeEventListener('pointercancel', gesture.onPointerCancel);

    if (this.longPressActive) {
      this.longPressActive = false;
      this.container.dispatchEvent(new CustomEvent('long-press-end'));
    } else if (allowTap && !gesture.moved) {
      this.trackpad.classList.add('clicked');
      this.vibrate('light');
      this.container.dispatchEvent(new CustomEvent('center'));
      clearTimeout(this.clickTimeout);
      this.clickTimeout = setTimeout(() => this.trackpad.classList.remove('clicked'), 30);
    }

    this.trackpadBall.style.marginTop = '0px';
    this.trackpadBall.style.marginLeft = '0px';
    this.trackpadBall.classList.remove('moving');
    clearTimeout(this.gestureResetTimeout);

    if (animate) {
      this.trackpadBall.classList.add('finished');
      this.gestureResetTimeout = setTimeout(() => {
        this.trackpadBall.classList.remove('finished');
        this.isMoving = false;
        this.gestureResetTimeout = null;
      }, 300);
    } else {
      this.trackpadBall.classList.remove('finished');
      this.isMoving = false;
      this.gestureResetTimeout = null;
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.activeGesture) {
      this._finishGesture(this.activeGesture, { allowTap: false, animate: false });
    }

    clearTimeout(this.longPressTimer);
    clearTimeout(this.fireEventTimeout);
    clearTimeout(this.gestureResetTimeout);
    clearTimeout(this.clickTimeout);
    this.longPressTimer = null;
    this.fireEventTimeout = null;
    this.gestureResetTimeout = null;
    this.clickTimeout = null;
    this.longPressActive = false;
    this.fireEventStarted = false;
    this.isMoving = false;
  }

  fireEvent() {
    this.fireEventStarted = true;
    this.vibrate();

    const stepSize = 1 / this.pollSteps;
    for (let i = 0; i < this.pollSteps; i++) {
      if (this.moveDistance <= (i + 1) * stepSize) {
        this.currentFireRate = this.fireRate / this.pollSteps * (this.pollSteps - i);
        break;
      }
    }

    if (this.moveDistance > 0.95) {
      this.currentFireRate = 60;
    }

    this.container.dispatchEvent(new CustomEvent('move', {
      detail: {
        direction: this.moveDirection,
        distance: Math.round(this.moveDistance * 100),
      },
    }));

    this.fireEventTimeout = setTimeout(() => {
      if (this.isMoving) this.fireEvent();
    }, this.currentFireRate);
  }

  vibrate(type = 'selection') {
    forwardHaptic(this.container, type);
    navigator.vibrate?.(type === 'selection' ? 20 : 50);
  }
}

class AndroidTVRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entity) throw new Error('androidtv-remote-card: entity is required');
    this._disposeRemote();
    this._config = config;
    this._render();
  }

  connectedCallback() {
    if (this._config && !this._remote) this._render();
  }

  disconnectedCallback() {
    this._disposeRemote();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config) this._updateState();
  }

  _disposeRemote() {
    this._remote?.destroy();
    this._remote = null;
    if (this._volumeRollerFrame) cancelAnimationFrame(this._volumeRollerFrame);
    this._volumeRollerFrame = null;
    this._volumeRoller = null;
    this._volumeRollerDrag = null;
    this._volumeRollerInteraction = false;
    this._volumeRollerAnimating = false;
  }

  _render() {
    const { _config: cfg } = this;
    const hasCustom = cfg.custom_buttons?.length > 0;

    this.style.height = cfg.height ? `${cfg.height}px` : '';

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="container">
          <div class="header">
            ${cfg.hide_title ? '' : `<h1 class="title">${cfg.name ?? ''}</h1>`}
            <div class="header__buttons">
              <div class="ui-button power-button">
                <ha-icon icon="mdi:power"></ha-icon>
              </div>
            </div>
          </div>
          <div class="trackpad">
            <div class="trackpad__ball"></div>
          </div>
          <div class="controls">
            <div class="ui-button back-button">
              <ha-icon icon="mdi:chevron-left"></ha-icon>
            </div>
            <div class="ui-button home-button">
              <ha-icon icon="mdi:home"></ha-icon>
            </div>
            <div class="volume-wrapper">

              <div class="ui-button volume-button">
                <ha-icon icon="mdi:volume-high"></ha-icon>
              </div>
              <div class="volume-panel">
                <span class="volume-value">50%</span>
                <div class="volume-roller" role="spinbutton" aria-label="Volume" aria-valuemin="0" aria-valuemax="${cfg.max_volume ?? 100}" aria-valuenow="50" tabindex="0">
                  <div class="volume-roller__track"></div>
                  <div class="volume-roller__selection"></div>
                </div>
                <div class="ui-button volume-mute-btn">
                  <ha-icon icon="mdi:volume-high"></ha-icon>
                </div>
              </div>
            </div>
          </div>
          
          ${hasCustom ? `
          <div class="controls controls--custom">
            ${cfg.custom_buttons.map(btn => {
              const esc = s => String(s ?? '').replace(/"/g, '&quot;');
              const icon = esc(btn.icon);
              let attrs = '';
              if (btn.activity != null)       attrs = `data-activity="${esc(btn.activity)}"`;
              else if (btn.adb_command != null) attrs = `data-command="${esc(btn.adb_command)}" data-adb`;
              else if (btn.command != null)    attrs = `data-command="${esc(btn.command)}"`;
              else if (btn.script != null)      attrs = `data-script="${esc(btn.script)}"`;
              else if (btn.automation != null)  attrs = `data-automation="${esc(btn.automation)}"`;
              return `<div class="ui-button custom-btn" ${attrs}><ha-icon icon="${icon}"></ha-icon></div>`;
            }).join('')}
          </div>
          ` : ''}
        </div>
      </ha-card>
    `;

    this._bindButtons();
    this._initRemote();
  }

  _initRemote() {
    const root = this.shadowRoot;
    const container = root.querySelector('.container');
    const remote = new Remote(
      container,
      root.querySelector('.trackpad'),
      root.querySelector('.trackpad__ball'),
      this._config,
    );
    this._remote = remote;

    container.addEventListener('move', ({ detail }) => {
      if (!this._isTvOff()) this._sendDpad(detail.direction);
    });
    container.addEventListener('center', () => {
      if (!this._isTvOff()) this._sendRemoteCommand('DPAD_CENTER');
    });
    container.addEventListener('long-press-start', () => {
      if (!this._isTvOff()) this._sendRemoteCommand('start_long:DPAD_CENTER');
    });
    container.addEventListener('long-press-end', () => {
      if (!this._isTvOff()) this._sendRemoteCommand('end_long:DPAD_CENTER');
    });
  }

  _bindButtons() {
    const root = this.shadowRoot;

    root.querySelector('.power-button').addEventListener('click', () => { this._haptic('medium'); this._togglePower(); });
    root.querySelector('.back-button').addEventListener('click', () => { this._haptic('light'); this._sendRemoteCommand('BACK'); });
    root.querySelector('.home-button').addEventListener('click', () => { this._haptic('light'); this._sendRemoteCommand('HOME'); });
    root.querySelector('.volume-button').addEventListener('click', () => { this._haptic('light'); this._toggleVolumePanel(); });
    root.querySelector('.volume-mute-btn').addEventListener('click', (e) => { e.stopPropagation(); this._haptic('light'); this._toggleMute(); this._resetVolumeClose(); });

    this._bindVolumeRoller(root);

    root.querySelectorAll('.custom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._haptic('light');
        if (btn.dataset.activity) {
          this._launchActivity(btn.dataset.activity);
        } else if ('adb' in btn.dataset) {
          this._sendAdb(btn.dataset.command);
        } else if (btn.dataset.command) {
          this._sendRemoteCommand(btn.dataset.command);
        } else if (btn.dataset.script) {
          this._runScript(btn.dataset.script);
        } else if (btn.dataset.automation) {
          this._triggerAutomation(btn.dataset.automation);
        }
      });
    });
  }

  _bindVolumeRoller(root) {
    const roller = root.querySelector('.volume-roller');
    const track = root.querySelector('.volume-roller__track');
    const configuredMax = Number(this._config.max_volume ?? 100);
    const max = Math.min(100, Math.max(1, Number.isFinite(configuredMax) ? Math.round(configuredMax) : 100));
    this._volumeRoller = roller;
    this._volumeRollerMax = max;
    this._volumeRollerPosition = 0;
    this._volumeRollerValue = -1;
    this._volumeRollerInteraction = false;
    this._volumeRollerAnimating = false;
    roller.setAttribute('aria-valuemax', String(max));

    for (let value = 0; value <= max; value++) {
      const item = document.createElement('div');
      item.className = 'volume-roller__item';
      item.textContent = String(value);
      track.appendChild(item);
    }

    const entityId = this._config.volume_entity ?? this._config.entity;
    const initialLevel = this._hass?.states?.[entityId]?.attributes?.volume_level ?? 0;
    this._setVolumeRollerPosition(Math.round(initialLevel * 100) * VOLUME_ROLLER_ROW_HEIGHT, { send: false });

    roller.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || (event.button != null && event.button !== 0)) return;
      event.preventDefault();
      roller.focus({ preventScroll: true });
      if (this._volumeRollerFrame) cancelAnimationFrame(this._volumeRollerFrame);
      this._volumeRollerFrame = null;
      this._volumeRollerAnimating = false;
      roller.classList.remove('rolling');
      this._volumeRollerInteraction = true;
      this._volumeRollerDrag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startPosition: this._volumeRollerPosition,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocity: 0,
      };
      roller.classList.add('dragging');
      roller.setPointerCapture(event.pointerId);
      this._resetVolumeClose();
    });

    roller.addEventListener('pointermove', (event) => {
      const drag = this._volumeRollerDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const now = performance.now();
      const elapsed = now - drag.lastTime;
      if (elapsed > 0) {
        const velocity = -(event.clientY - drag.lastY) / elapsed;
        drag.velocity = drag.velocity * 0.65 + velocity * 0.35;
      }
      drag.lastY = event.clientY;
      drag.lastTime = now;
      this._setVolumeRollerPosition(
        drag.startPosition - (event.clientY - drag.startY),
      );
    });

    const finishGesture = (event, allowInertia) => {
      const drag = this._volumeRollerDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      this._volumeRollerDrag = null;
      roller.classList.remove('dragging');
      if (roller.hasPointerCapture(event.pointerId)) roller.releasePointerCapture(event.pointerId);
      if (allowInertia && Math.abs(drag.velocity) > 0.05) {
        this._animateVolumeRoller(drag.velocity);
      } else {
        const snappedPosition = Math.round(this._volumeRollerPosition / VOLUME_ROLLER_ROW_HEIGHT) * VOLUME_ROLLER_ROW_HEIGHT;
        this._setVolumeRollerPosition(snappedPosition);
        this._volumeRollerInteraction = false;
      }
    };

    roller.addEventListener('pointerup', (event) => finishGesture(event, true));
    roller.addEventListener('pointercancel', (event) => finishGesture(event, false));
    roller.addEventListener('lostpointercapture', (event) => finishGesture(event, false));
    roller.addEventListener('keydown', (event) => {
      let nextValue;
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') nextValue = this._volumeRollerValue + 1;
      else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') nextValue = this._volumeRollerValue - 1;
      else if (event.key === 'PageUp') nextValue = this._volumeRollerValue + 10;
      else if (event.key === 'PageDown') nextValue = this._volumeRollerValue - 10;
      else if (event.key === 'Home') nextValue = 0;
      else if (event.key === 'End') nextValue = max;
      if (nextValue == null) return;
      event.preventDefault();
      this._setVolumeRollerPosition(nextValue * VOLUME_ROLLER_ROW_HEIGHT);
    });
  }

  _setVolumeRollerPosition(position, { send = true } = {}) {
    if (!this._volumeRoller) return 0;
    const maxPosition = this._volumeRollerMax * VOLUME_ROLLER_ROW_HEIGHT;
    const clampedPosition = Math.max(0, Math.min(maxPosition, position));
    const selectedValue = Math.round(clampedPosition / VOLUME_ROLLER_ROW_HEIGHT);
    this._volumeRollerPosition = clampedPosition;
    this._volumeRoller.querySelector('.volume-roller__track').style.transform =
      `translateY(${-clampedPosition - VOLUME_ROLLER_ROW_HEIGHT / 2}px)`;

    if (selectedValue !== this._volumeRollerValue) {
      const previousValue = this._volumeRollerValue;
      this._volumeRollerValue = selectedValue;
      const track = this._volumeRoller.querySelector('.volume-roller__track');
      if (previousValue >= 0) {
        track.children[previousValue]?.classList.remove('selected', 'near');
        for (const offset of [-2, -1, 1, 2]) {
          track.children[previousValue + offset]?.classList.remove('near');
        }
      }
      track.children[selectedValue]?.classList.add('selected');
      for (const offset of [-2, -1, 1, 2]) {
        track.children[selectedValue + offset]?.classList.add('near');
      }

      this._volumeRoller.setAttribute('aria-valuenow', String(selectedValue));
      this._volumeRoller.setAttribute('aria-valuetext', selectedValue === 0 ? 'Muted' : `${selectedValue}%`);
      this.shadowRoot.querySelector('.volume-value').textContent = `${selectedValue}%`;
      if (send && previousValue >= 0) this._applyVolumeValue(selectedValue);
    }
    return clampedPosition;
  }

  _applyVolumeValue(value) {
    this._resetVolumeClose();
    const entityId = this._config.volume_entity ?? this._config.entity;
    const isMuted = this._hass?.states?.[entityId]?.attributes?.is_volume_muted ?? false;
    if (!isMuted) {
      this.shadowRoot.querySelector('.volume-mute-btn ha-icon')?.setAttribute('icon', this._levelIcon(value / 100));
    }
    this._haptic('selection');
    this._setVolume(value / 100);
  }

  _animateVolumeRoller(velocity) {
    this._volumeRollerAnimating = true;
    this._volumeRoller.classList.add('rolling');
    let lastTime = performance.now();

    const animate = (time) => {
      const elapsed = Math.min(time - lastTime, 32);
      lastTime = time;
      const nextPosition = this._volumeRollerPosition + velocity * elapsed;
      const position = this._setVolumeRollerPosition(nextPosition);
      if (position !== nextPosition) velocity = 0;
      velocity *= Math.pow(0.94, elapsed / 16);

      if (Math.abs(velocity) > 0.02) {
        this._volumeRollerFrame = requestAnimationFrame(animate);
        return;
      }

      this._volumeRollerFrame = null;
      this._volumeRoller.classList.remove('rolling');
      this._setVolumeRollerPosition(
        Math.round(this._volumeRollerPosition / VOLUME_ROLLER_ROW_HEIGHT) * VOLUME_ROLLER_ROW_HEIGHT,
      );
      this._volumeRollerAnimating = false;
      this._volumeRollerInteraction = false;
    };

    this._volumeRollerFrame = requestAnimationFrame(animate);
  }

  _updateState() {
    const root = this.shadowRoot;
    if (!root.querySelector('.container')) return;

    const entity = this._hass.states[this._config.entity];
    if (!entity) return;

    const title = root.querySelector('.title');
    if (title && !this._config.name) {
      title.textContent = entity.attributes.friendly_name ?? this._config.entity;
    }

    const isOn = entity.state !== 'off' && entity.state !== 'unavailable';
    root.querySelector('.power-button').classList.toggle('power-on', isOn);

    const volEntityId = this._config.volume_entity ?? this._config.entity;
    const volEntity = this._hass.states[volEntityId];
    if (volEntity) {
      const isMuted = volEntity.attributes.is_volume_muted ?? false;
      const volBtn = root.querySelector('.volume-button');
      volBtn.classList.toggle('muted', isMuted);
      const panelOpen = root.querySelector('.volume-panel').classList.contains('open');
      const volIcon = this._volumeIcon();
      const volBtnIcon = volBtn.querySelector('ha-icon');
      if (!panelOpen && volBtnIcon.getAttribute('icon') !== volIcon) {
        volBtnIcon.setAttribute('icon', volIcon);
      }
      const muteIcon = root.querySelector('.volume-mute-btn ha-icon');
      if (muteIcon.getAttribute('icon') !== volIcon) {
        muteIcon.setAttribute('icon', volIcon);
      }

      if (this._volumeRoller && !this._volumeRollerInteraction) {
        const pct = Math.min(
          Math.round((volEntity.attributes.volume_level ?? 0) * 100),
          this._volumeRollerMax,
        );
        this._setVolumeRollerPosition(pct * VOLUME_ROLLER_ROW_HEIGHT, { send: false });
      }
    }
  }

  _remoteEntity() {
    return this._config.remote_entity
      ?? this._config.entity.replace(/^media_player\./, 'remote.');
  }

  _isTvOff() {
    const state = this._hass?.states?.[this._config.entity]?.state;
    return state === 'off' || state === 'unavailable';
  }

  _sendRemoteCommand(command) {
    this._hass?.callService('remote', 'send_command', {
      entity_id: this._remoteEntity(),
      command,
    });
  }

  _haptic(type = 'light') {
    forwardHaptic(this, type);
    navigator.vibrate?.(type === 'medium' ? 60 : 35);
  }

  _launchActivity(activity) {
    this._hass?.callService('remote', 'turn_on', {
      entity_id: this._remoteEntity(),
      activity,
    });
  }

  _sendAdb(command) {
    this._hass?.callService('androidtv', 'adb_command', {
      entity_id: this._config.entity,
      command,
    });
  }

  _runScript(entityId) {
    this._hass?.callService('script', 'turn_on', { entity_id: entityId });
  }

  _triggerAutomation(entityId) {
    this._hass?.callService('automation', 'trigger', { entity_id: entityId });
  }

  _sendDpad(direction) {
    const map = {
      up:    'DPAD_UP',
      down:  'DPAD_DOWN',
      left:  'DPAD_LEFT',
      right: 'DPAD_RIGHT',
    };
    if (map[direction]) this._sendRemoteCommand(map[direction]);
  }

  _togglePower() {
    const entity = this._hass?.states[this._config.entity];
    if (!entity) return;
    const service = entity.state === 'off' ? 'turn_on' : 'turn_off';
    this._hass.callService('media_player', service, { entity_id: this._config.entity });
  }

  _toggleVolumePanel() {
    const panel = this.shadowRoot.querySelector('.volume-panel');
    const volIcon = this.shadowRoot.querySelector('.volume-button ha-icon');
    const isOpen = panel.classList.contains('open');
    if (!isOpen) {
      const trackpadH = this.shadowRoot.querySelector('.trackpad').getBoundingClientRect().height;
      panel.style.height = `${trackpadH}px`;
    }
    panel.classList.toggle('open', !isOpen);
    volIcon.setAttribute('icon', isOpen ? this._volumeIcon() : 'mdi:close');
    if (!isOpen) {
      this._resetVolumeClose();
    } else {
      clearTimeout(this._volumeCloseTimer);
    }
  }

  _volumeIcon() {
    const entityId = this._config.volume_entity ?? this._config.entity;
    const entity = this._hass?.states[entityId];
    if (entity?.attributes.is_volume_muted) return 'mdi:volume-mute';
    return this._levelIcon(entity?.attributes.volume_level ?? 0);
  }

  _levelIcon(level) {
    const max = (this._config?.max_volume ?? 100) / 100;
    const n = max > 0 ? level / max : 0;
    if (n === 0)    return 'mdi:volume-off';
    if (n < 0.34)  return 'mdi:volume-low';
    if (n < 0.67)  return 'mdi:volume-medium';
    return 'mdi:volume-high';
  }

  _resetVolumeClose() {
    clearTimeout(this._volumeCloseTimer);
    this._volumeCloseTimer = setTimeout(() => {
      const root = this.shadowRoot;
      root.querySelector('.volume-panel')?.classList.remove('open');
      root.querySelector('.volume-button ha-icon')?.setAttribute('icon', this._volumeIcon());
    }, 4000);
  }

  _setVolume(level) {
    const entityId = this._config.volume_entity ?? this._config.entity;
    this._hass?.callService('media_player', 'volume_set', {
      entity_id: entityId,
      volume_level: Math.round(level * 100) / 100,
    });
  }

  _toggleMute() {
    const entityId = this._config.volume_entity ?? this._config.entity;
    const entity = this._hass?.states[entityId];
    if (!entity) return;
    this._hass.callService('media_player', 'volume_mute', {
      entity_id: entityId,
      is_volume_muted: !(entity.attributes.is_volume_muted ?? false),
    });
  }

  getCardSize() { return 7; }

  static getConfigElement() {
    return document.createElement('androidtv-remote-card-editor');
  }

  static getStubConfig() {
    return { entity: 'media_player.android_tv' };
  }
}

const EDITOR_SCHEMA = [
  { name: 'entity',         required: true, label: 'TV entity (media_player)',          selector: { entity: { domain: 'media_player' } } },
  { name: 'remote_entity',                  label: 'Remote entity - auto-derived (optional, default: TV entity)',       selector: { entity: { domain: 'remote' } } },
  { name: 'name',                           label: 'Card title (optional)',                         selector: { text: {} } },
  { name: 'volume_entity',                  label: 'Volume entity - soundbar etc. (optional, default: TV entity)',      selector: { entity: { domain: 'media_player' } } },
  { name: 'hide_title',                     label: 'Hide title',                         selector: { boolean: {} } },
  { name: 'max_volume',                     label: 'Max volume %',                       selector: { number: { min: 1, max: 100, step: 1,   mode: 'box' } } },
  { name: 'height',                         label: 'Card height (px)',                   selector: { number: { min: 200, max: 1200, step: 10, mode: 'box' } } },
  { name: 'trackpad_long_press',             label: 'Trackpad long press',                 selector: { boolean: {} } },
  { name: 'trackpad_long_press_delay',       label: 'Long press delay (ms)',               selector: { number: { min: 0, max: 10000, step: 50, mode: 'box' } } },
];

class AndroidTVRemoteCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const form = this.shadowRoot.querySelector('ha-form');
    if (form) form.hass = hass;
  }

  _render() {
    this.shadowRoot.innerHTML = `<style>
      p { margin: 12px 0 0; font-size: 12px; color: var(--secondary-text-color, #888); }
    </style>`;

    const form = document.createElement('ha-form');
    form.hass = this._hass;
    form.data = {
      trackpad_long_press: false,
      trackpad_long_press_delay: 500,
      ...this._config,
    };
    form.schema = EDITOR_SCHEMA;
    form.computeLabel = (s) => s.label ?? s.name;
    form.addEventListener('value-changed', (e) => {
      this._config = e.detail.value;
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }));
    });
    this.shadowRoot.appendChild(form);

    const note = document.createElement('p');
    note.textContent = 'custom_buttons requires YAML configuration.';
    this.shadowRoot.appendChild(note);
  }
}

customElements.define('androidtv-remote-card-editor', AndroidTVRemoteCardEditor);
customElements.define(CARD_TAG, AndroidTVRemoteCard);

window.customCards ??= [];
window.customCards.push({
  type: CARD_TAG,
  name: 'Android TV Remote',
  description: 'Trackpad remote control for Android TV via ADB',
});
